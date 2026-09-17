/**
 * 首页 Dashboard 服务层(PRD 3.7):五卡片只读数据
 *
 * - 训练卡:六态推导(3.7.3;无启用周期/休息日/未开始/进行中/已完成/未完成)
 * - 营养卡:当日 diet_items 汇总 × nutrition_goals(3.7.4)
 * - 饮水卡:当日 water_logs 总量 × waterMl 目标(3.7.5)
 * - 补剂卡:当日打卡次数 × Σ每日目标(3.7.6/3.9.4;无目标仅显示次数)
 * - 体重卡:最新两条 body_weight_records(3.7.7;体重权威源,TECH 2.3)
 *
 * 所有查询均带 user_id 条件(分层红线);today 为服务端 UTC+8 日历日。
 */
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bodyWeightRecords,
  dayMarks,
  dietItems,
  supplementLogs,
  supplements,
  trainingDays,
  trainingItems,
  trainings,
  trainingSessions,
  waterLogs,
} from "@/db/schema";
import { getActiveCycle } from "./cycles";
import { getNutritionGoals } from "./onboarding";

/** 训练卡六态(3.7.3;周期内当天无计划归入 no_plan,3.2.4 空状态) */
export type TrainingCardState =
  | "no_cycle"
  | "no_plan"
  | "rest"
  | "not_started"
  | "in_progress"
  | "completed"
  | "missed";

export interface TrainingCard {
  state: TrainingCardState;
  /** 训练名(多训练以 " + " 连接);状态类形态为展示文案 */
  title: string;
  /** 未开始:动作总数 */
  exerciseCount?: number;
  /** 进行中:自 startedAt 起的分钟数 */
  elapsedMinutes?: number;
}

export interface MacroStat {
  current: number;
  goal: number | null;
}

export interface DashboardData {
  training: TrainingCard;
  nutrition: {
    kcal: MacroStat;
    protein: MacroStat;
    carbs: MacroStat;
    fat: MacroStat;
  };
  water: { currentMl: number; goalMl: number | null };
  supplements: {
    /** 活跃补剂(打卡 Sheet 数据源,3.9.3) */
    list: { id: string; name: string; unit: string; dose: string }[];
    todayCount: number;
    /** Σ 每日目标;0 = 无目标(仅显示次数,3.9.4) */
    targetCount: number;
  };
  weight: {
    latestKg: string | null;
    latestDate: string | null;
    /** 最新 − 上次;仅一条记录时为 null */
    deltaKg: number | null;
    /** 今日已有记录(同日覆盖确认依据,3.2.6) */
    todayRecorded: boolean;
  };
}

export async function getDashboardData(
  userId: string,
  today: string,
): Promise<DashboardData> {
  const [training, nutrition, water, supplements, weight] = await Promise.all([
    getTrainingCard(userId, today),
    getNutritionCard(userId, today),
    getWaterCard(userId, today),
    getSupplementCard(userId, today),
    getWeightCard(userId, today),
  ]);

  return { training, nutrition, water, supplements, weight };
}

/** 训练卡状态机(判定优先级:进行中 > 已完成 > 手动未完成 > 未开始) */
async function getTrainingCard(userId: string, today: string): Promise<TrainingCard> {
  const cycle = await getActiveCycle(userId);
  if (!cycle) return { state: "no_cycle", title: "无启用训练周期" };

  const [day] = await db
    .select()
    .from(trainingDays)
    .where(and(eq(trainingDays.cycleId, cycle.id), eq(trainingDays.date, today)))
    .limit(1);
  if (!day) return { state: "no_plan", title: "今天暂无训练计划" };
  if (day.isRest) return { state: "rest", title: "今天是休息日" };

  const [dayTrainings, sessions] = await Promise.all([
    db
      .select({ id: trainings.id, name: trainings.name, itemCount: count(trainingItems.id) })
      .from(trainings)
      .leftJoin(trainingItems, eq(trainingItems.trainingId, trainings.id))
      .where(eq(trainings.trainingDayId, day.id))
      .groupBy(trainings.id, trainings.name, trainings.sortOrder)
      .orderBy(trainings.sortOrder),
    db
      .select({
        trainingId: trainingSessions.trainingId,
        status: trainingSessions.status,
        startedAt: trainingSessions.startedAt,
      })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, today))),
  ]);

  // 进行中(中断未结束)→ 继续训练入口(3.1.10/3.7.3)
  const inProgress = sessions.find((s) => s.status === "进行中");
  if (inProgress) {
    const name = dayTrainings.find((t) => t.id === inProgress.trainingId)?.name ?? "训练中";
    return {
      state: "in_progress",
      title: name,
      elapsedMinutes: Math.max(
        0,
        Math.floor((Date.now() - inProgress.startedAt.getTime()) / 60000),
      ),
    };
  }

  // 任一训练有完成记录即已完成(3.1.9)
  const completedNames = dayTrainings
    .filter((t) => sessions.some((s) => s.trainingId === t.id && s.status === "已完成"))
    .map((t) => t.name);
  if (completedNames.length > 0) {
    return { state: "completed", title: completedNames.join(" + ") };
  }

  // 手动标记"今天未训练"(3.1.9;当日可撤销)
  const [mark] = await db
    .select()
    .from(dayMarks)
    .where(and(eq(dayMarks.userId, userId), eq(dayMarks.date, today), eq(dayMarks.kind, "missed")))
    .limit(1);
  if (mark) return { state: "missed", title: "已标记今日未训练" };

  return {
    state: "not_started",
    title: dayTrainings.map((t) => t.name).join(" + ") || "今日训练",
    exerciseCount: dayTrainings.reduce((n, t) => n + t.itemCount, 0),
  };
}

/** 营养卡:当日摄入汇总 × 目标(grams × per100 / 100,快照列计算) */
async function getNutritionCard(userId: string, today: string) {
  const [totals, goals] = await Promise.all([
    db
      .select({
        kcal: sql<string>`coalesce(sum(${dietItems.kcalPer100} * ${dietItems.grams} / 100), 0)`,
        protein: sql<string>`coalesce(sum(${dietItems.proteinPer100} * ${dietItems.grams} / 100), 0)`,
        carbs: sql<string>`coalesce(sum(${dietItems.carbsPer100} * ${dietItems.grams} / 100), 0)`,
        fat: sql<string>`coalesce(sum(${dietItems.fatPer100} * ${dietItems.grams} / 100), 0)`,
      })
      .from(dietItems)
      .where(and(eq(dietItems.userId, userId), eq(dietItems.date, today))),
    getNutritionGoals(userId),
  ]);

  return {
    kcal: { current: Math.round(Number(totals[0]?.kcal ?? 0)), goal: goals?.caloriesKcal ?? null },
    protein: { current: Math.round(Number(totals[0]?.protein ?? 0)), goal: goals?.proteinG ?? null },
    carbs: { current: Math.round(Number(totals[0]?.carbs ?? 0)), goal: goals?.carbsG ?? null },
    fat: { current: Math.round(Number(totals[0]?.fat ?? 0)), goal: goals?.fatG ?? null },
  };
}

/** 饮水卡:当日总量 × waterMl 目标 */
async function getWaterCard(userId: string, today: string) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${waterLogs.amountMl}), 0)` })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, today)));
  const goals = await getNutritionGoals(userId);
  return { currentMl: Number(row?.total ?? 0), goalMl: goals?.waterMl ?? null };
}

/** 补剂卡:活跃列表 + 当日打卡数 + Σ每日目标(3.9.4) */
async function getSupplementCard(userId: string, today: string) {
  const [list, [cnt]] = await Promise.all([
    db
      .select({ id: supplements.id, name: supplements.name, unit: supplements.unit, dose: supplements.dose, dailyTarget: supplements.dailyTarget })
      .from(supplements)
      .where(and(eq(supplements.userId, userId), isNull(supplements.deletedAt)))
      .orderBy(supplements.name),
    db
      .select({ n: count() })
      .from(supplementLogs)
      .where(and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, today))),
  ]);

  return {
    list: list.map((s) => ({ id: s.id, name: s.name, unit: s.unit, dose: s.dose })),
    todayCount: cnt?.n ?? 0,
    targetCount: list.reduce((n, s) => n + (s.dailyTarget ? Number(s.dailyTarget) : 0), 0),
  };
}

/** 体重卡:最新两条(权威源 body_weight_records,TECH 2.3) */
async function getWeightCard(userId: string, today: string) {
  const recent = await db
    .select({ date: bodyWeightRecords.date, weightKg: bodyWeightRecords.weightKg })
    .from(bodyWeightRecords)
    .where(eq(bodyWeightRecords.userId, userId))
    .orderBy(desc(bodyWeightRecords.date), desc(bodyWeightRecords.createdAt))
    .limit(2);

  const latest = recent[0] ?? null;
  return {
    latestKg: latest?.weightKg ?? null,
    latestDate: latest?.date ?? null,
    deltaKg:
      recent.length === 2 ? Number(recent[0].weightKg) - Number(recent[1].weightKg) : null,
    todayRecorded: latest?.date === today,
  };
}
