/**
 * 数据统计服务层(PRD 3.11):今日/周/月数据
 *
 * - 今日:复用 DashboardData(3.11.3 规定与首页同源只读)
 * - 周(STAT-002):本周一至周日;含完成率公式(3.11.10 评审 1:休息日与未来日不计入分母)
 * - 月(STAT-003):本月 1 日至月末,指标同周 + 训练总次数
 * - 范围日状态判定:单日四态(no_plan / rest / completed / missed / not_started_future)
 *   → 周/月聚合只统计 休息日+未来日 之外
 *
 * today 统一 serverToday;范围按"含 today"计算,昨日及之前为历史,周一/月首为边界。
 */
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { addDays, dateRange, parseYmd } from "@/lib/date-math";
import { serverToday } from "@/lib/date";

import { db } from "@/db";
import {
  bodyWeightRecords,
  dayMarks,
  dietItems,
  trainingCycles,
  trainingDays,
  trainingSessions,
  trainings,
} from "@/db/schema";

/* ============================================================
 * 范围工具
 * ============================================================ */

/** 本周一起点(周一=1, ISO 周首;3.11.4 边界规则) */
function weekStart(today: string): string {
  const d = parseYmd(today);
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat;ISO 偏移 = (getUTCDay + 6) % 7
  const isoOffset = (d.getUTCDay() + 6) % 7;
  return addDays(today, -isoOffset);
}

/** 本月 1 日 */
function monthStart(today: string): string {
  const [, m] = today.split("-");
  return `${today.split("-")[0]}-${m}-01`;
}

/* ============================================================
 * 单日训练判定
 * ============================================================ */

type DayKind = "rest" | "completed" | "missed" | "not_done" | "no_plan" | "future";

interface DayAssessment {
  date: string;
  kind: DayKind;
}

/**
 * 范围日状态批量判定(N 日单次查询)
 * - rest: trainingDay.isRest=true
 * - completed: 当日有 status='已完成' session
 * - missed: dayMarks.kind='missed' 手动标记
 * - not_done: 有 trainingDay 但既未完成也未标记
 * - no_plan: 无 trainingDay 记录
 * - future: 日期 > today
 */
async function assessDays(userId: string, dates: string[]): Promise<Map<string, DayKind>> {
  const map = new Map<string, DayKind>();
  const today = serverToday();
  for (const d of dates) {
    if (d > today) map.set(d, "future");
  }
  const past = dates.filter((d) => d <= today);
  if (past.length === 0) return map;

  // 补 future 默认
  for (const d of past) if (!map.has(d)) map.set(d, "no_plan");

  // 一次拉所有相关行(用 IN 列表)
  const [days, sessions, marks] = await Promise.all([
    db
      .select({ date: trainingDays.date, isRest: trainingDays.isRest })
      .from(trainingDays)
      .innerJoin(trainingCycles, eq(trainingCycles.id, trainingDays.cycleId))
      .where(
        and(
          eq(trainingCycles.userId, userId),
          gte(trainingDays.date, past[0]),
          lte(trainingDays.date, past[past.length - 1]),
        ),
      ),
    db
      .select({ date: trainingSessions.date })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          eq(trainingSessions.status, "已完成"),
          gte(trainingSessions.date, past[0]),
          lte(trainingSessions.date, past[past.length - 1]),
        ),
      ),
    db
      .select({ date: dayMarks.date })
      .from(dayMarks)
      .where(
        and(
          eq(dayMarks.userId, userId),
          eq(dayMarks.kind, "missed"),
          gte(dayMarks.date, past[0]),
          lte(dayMarks.date, past[past.length - 1]),
        ),
      ),
  ]);

  const restSet = new Set(days.filter((d) => d.isRest).map((d) => d.date));
  const planSet = new Set(days.map((d) => d.date));
  const doneSet = new Set(sessions.map((s) => s.date));
  const missSet = new Set(marks.map((m) => m.date));

  for (const d of past) {
    if (restSet.has(d)) map.set(d, "rest");
    else if (doneSet.has(d)) map.set(d, "completed");
    else if (missSet.has(d)) map.set(d, "missed");
    else if (planSet.has(d)) map.set(d, "not_done");
    // else 保持 no_plan
  }
  return map;
}

/* ============================================================
 * 训练统计
 * ============================================================ */

export interface TrainingStats {
  completedDays: number;
  notDoneDays: number;
  /** 完成率百分比(0~100);分母为 0 时返回 null(3.11.4 公式:休息日与未来日不计入分母) */
  rate: number | null;
}

function aggregateTraining(days: DayKind[]): TrainingStats {
  // 3.11.4 公式:完成率 = 完成天数 ÷ (完成 + 未完成) × 100;rest/future/no_plan 不计入分母
  let completed = 0;
  let notDone = 0;
  for (const k of days) {
    if (k === "completed") completed++;
    else if (k === "not_done") notDone++;
  }
  const denom = completed + notDone;
  return {
    completedDays: completed,
    notDoneDays: notDone,
    rate: denom > 0 ? Math.round((completed / denom) * 100) : null,
  };
}

/* ============================================================
 * 营养统计(日均,3.11.4:周总值 ÷ 有饮食记录的天数)
 * ============================================================ */

export interface NutritionStats {
  /** 日均热量(kcal,整数);无记录时 null */
  avgKcal: number | null;
  /** 日均蛋白质(g,整数) */
  avgProteinG: number | null;
  /** 有饮食记录的天数 */
  recordedDays: number;
}

async function aggregateNutrition(
  userId: string,
  start: string,
  end: string,
): Promise<NutritionStats> {
  // 范围内按日期聚合每日 kcal/protein 总和
  const rows = await db
    .select({
      date: dietItems.date,
      kcal: sql<string>`sum(${dietItems.kcalPer100} * ${dietItems.grams} / 100)`,
      protein: sql<string>`sum(${dietItems.proteinPer100} * ${dietItems.grams} / 100)`,
    })
    .from(dietItems)
    .where(
      and(
        eq(dietItems.userId, userId),
        gte(dietItems.date, start),
        lte(dietItems.date, end),
      ),
    )
    .groupBy(dietItems.date);

  if (rows.length === 0) return { avgKcal: null, avgProteinG: null, recordedDays: 0 };
  const totalKcal = rows.reduce((s, r) => s + Number(r.kcal), 0);
  const totalProtein = rows.reduce((s, r) => s + Number(r.protein), 0);
  const n = rows.length;
  return {
    avgKcal: Math.round(totalKcal / n),
    avgProteinG: Math.round(totalProtein / n),
    recordedDays: n,
  };
}

/* ============================================================
 * 体重统计
 * ============================================================ */

export interface WeightStats {
  start: { date: string; weightKg: number } | null;
  end: { date: string; weightKg: number } | null;
  /** end − start(kg;无 start 时 null) */
  deltaKg: number | null;
}

async function aggregateWeight(
  userId: string,
  start: string,
  end: string,
): Promise<WeightStats> {
  // 范围起点最近 + 范围终点最近(各取 1)
  const rows = await db
    .select({ date: bodyWeightRecords.date, weightKg: bodyWeightRecords.weightKg })
    .from(bodyWeightRecords)
    .where(
      and(
        eq(bodyWeightRecords.userId, userId),
        gte(bodyWeightRecords.date, start),
        lte(bodyWeightRecords.date, end),
      ),
    )
    .orderBy(asc(bodyWeightRecords.date));
  if (rows.length === 0) return { start: null, end: null, deltaKg: null };
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    start: { date: first.date, weightKg: Number(first.weightKg) },
    end: { date: last.date, weightKg: Number(last.weightKg) },
    deltaKg: rows.length > 1 ? Number(last.weightKg) - Number(first.weightKg) : null,
  };
}

/* ============================================================
 * 公开 API
 * ============================================================ */

export interface PeriodStats {
  rangeStart: string;
  rangeEnd: string;
  training: TrainingStats;
  nutrition: NutritionStats;
  weight: WeightStats;
}

/** 周统计(本周一至今日,3.11.4) */
export async function getWeekStats(userId: string, today?: string): Promise<PeriodStats> {
  const t = today ?? serverToday();
  const start = weekStart(t);
  const end = t;
  const dates = dateRange(start, end);
  const [assess, nutrition, weight] = await Promise.all([
    assessDays(userId, dates),
    aggregateNutrition(userId, start, end),
    aggregateWeight(userId, start, end),
  ]);
  return {
    rangeStart: start,
    rangeEnd: end,
    training: aggregateTraining(dates.map((d) => assess.get(d) ?? "future")),
    nutrition,
    weight,
  };
}

/** 月统计(本月 1 日至今日,3.11.5) */
export async function getMonthStats(userId: string, today?: string): Promise<PeriodStats> {
  const t = today ?? serverToday();
  const start = monthStart(t);
  const end = t;
  const dates = dateRange(start, end);
  const [assess, nutrition, weight] = await Promise.all([
    assessDays(userId, dates),
    aggregateNutrition(userId, start, end),
    aggregateWeight(userId, start, end),
  ]);
  return {
    rangeStart: start,
    rangeEnd: end,
    training: aggregateTraining(dates.map((d) => assess.get(d) ?? "future")),
    nutrition,
    weight,
  };
}

/* ============================================================
 * 体重趋势(3.11.7 折线图数据源)
 * ============================================================ */

export interface WeightPoint {
  date: string;
  weightKg: number;
}

export type WeightRangeKey = "7d" | "30d" | "90d";

export interface WeightTrend {
  points: WeightPoint[];
  latest: WeightPoint | null;
  /** latest − previous(kg;仅 2 点以上时非 null) */
  deltaKg: number | null;
}

const RANGE_DAYS: Record<WeightRangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

export async function getWeightTrend(
  userId: string,
  rangeKey: WeightRangeKey,
  today?: string,
): Promise<WeightTrend> {
  const t = today ?? serverToday();
  const start = addDays(t, -(RANGE_DAYS[rangeKey] - 1));
  const rows = await db
    .select({ date: bodyWeightRecords.date, weightKg: bodyWeightRecords.weightKg })
    .from(bodyWeightRecords)
    .where(
      and(
        eq(bodyWeightRecords.userId, userId),
        gte(bodyWeightRecords.date, start),
        lte(bodyWeightRecords.date, t),
      ),
    )
    .orderBy(asc(bodyWeightRecords.date));
  const points: WeightPoint[] = rows.map((r) => ({ date: r.date, weightKg: Number(r.weightKg) }));
  const latest = points[points.length - 1] ?? null;
  const prev = points[points.length - 2] ?? null;
  return {
    points,
    latest,
    deltaKg: latest && prev ? latest.weightKg - prev.weightKg : null,
  };
}

/* ============================================================
 * 体重最新 10 条(3.11.7 列表)
 * ============================================================ */

export async function listWeightRecent(userId: string, limit = 10) {
  const rows = await db
    .select({ date: bodyWeightRecords.date, weightKg: bodyWeightRecords.weightKg })
    .from(bodyWeightRecords)
    .where(eq(bodyWeightRecords.userId, userId))
    .orderBy(desc(bodyWeightRecords.date), desc(bodyWeightRecords.createdAt))
    .limit(limit);
  return rows.map((r) => ({ date: r.date, weightKg: Number(r.weightKg) }));
}

/* ============================================================
 * 训练日历(3.11.6):月历视图 + 点击当日摘要
 * ============================================================ */

export type DayKindForCalendar = "rest" | "completed" | "missed" | "not_done" | "no_plan" | "future";

export interface CalendarDay {
  date: string;
  kind: DayKindForCalendar;
  /** 当日训练名(无则 null) */
  trainingNames: string[];
}

export interface CalendarMonth {
  month: string; // YYYY-MM
  days: CalendarDay[];
}

/** 月历:YYYY-MM 字符串 + 起止日(1 日 ~ 月末) */
function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  // 当月 1 日
  const startDate = new Date(Date.UTC(y, m - 1, 1));
  // 下月 1 日 减 1 = 当月末
  const endDate = new Date(Date.UTC(y, m, 0));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

/**
 * 给定月份(YYYY-MM),返回该月每日训练状态(3.11.6 四态 + 未来)
 * - 通过复用 assessDays(单次 join cycles/days/sessions/marks 拉整个月)
 */
export async function getCalendarMonth(
  userId: string,
  month: string,
  today?: string,
): Promise<CalendarMonth> {
  const t = today ?? serverToday();
  const { start, end } = monthBounds(month);
  const dates = dateRange(start, end);

  const assess = await assessDays(userId, dates);

  // 日历只展示四态(3.11.6 评审 3:不展示训练名,摘要走 ?day= 单独页)
  const days: CalendarDay[] = dates.map((d) => ({
    date: d,
    kind: assess.get(d) ?? "no_plan",
    trainingNames: [],
  }));

  return { month, days };
}

/**
 * 当日训练摘要(3.11.6 点击日历日 → 摘要)
 * 返回:训练名列表 + 状态;无训练日返回空数组
 */
export async function getDayTrainingSummary(
  userId: string,
  date: string,
): Promise<{ date: string; trainings: { name: string; status: string }[] }> {
  // 该日是否在任意 cycle 的 training_day
  const dayList = await db
    .select({ id: trainingDays.id })
    .from(trainingDays)
    .innerJoin(trainingCycles, eq(trainingCycles.id, trainingDays.cycleId))
    .where(
      and(eq(trainingCycles.userId, userId), eq(trainingDays.date, date)),
    )
    .limit(1);
  if (dayList.length === 0) return { date, trainings: [] };

  const rows = await db
    .select({ name: trainings.name, status: trainingSessions.status })
    .from(trainings)
    .leftJoin(
      trainingSessions,
      and(
        eq(trainingSessions.trainingId, trainings.id),
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.date, date),
      ),
    )
    .where(eq(trainings.trainingDayId, dayList[0].id))
    .orderBy(trainings.sortOrder);

  return {
    date,
    trainings: rows.map((t) => ({ name: t.name, status: t.status ?? "未开始" })),
  };
}
