/**
 * 训练日/计划训练服务层(PRD 3.1.5 / 3.1.9 / 3.1.11)
 *
 * - 周列表:getCycleWeek 某自然周每天的计划/状态/休息日(RSC 直出)
 * - 日编辑:getDayDetail 当日训练卡列表
 * - 写操作:追加训练(一天多训练追加制)、改名/删训练、设/取消休息日
 * - "历史日期只读":date < today 一律拒绝(3.1.5 休息日规则推广到全部计划编辑)
 * - "修改只影响未来":删除计划训练不影响训练历史(sessions/set_logs);
 *   已被 session 引用的训练物理删会被 FK 拒绝,前置检查返回 HAS_RECORDS
 */
import { and, between, eq, inArray, isNull, sql } from "drizzle-orm";

import { addDays, cycleWeeks, weekIndexOf, weekStartOf, weekdayCN } from "@/lib/cycles";
import { serverToday } from "@/lib/date";

import { db } from "@/db";
import {
  dayMarks,
  trainingCycles,
  trainingDays,
  trainingItems,
  trainings,
  trainingSessions,
  type Training,
} from "@/db/schema";

/* ============================================================
 * 读:周列表 / 日详情
 * ============================================================ */

/** 周列表单日视图(可序列化,直接喂给客户端组件) */
export interface WeekDayView {
  date: string;
  /** "周一"~"周日" */
  weekday: string;
  /** "9月27日" */
  dayLabel: string;
  isToday: boolean;
  isPast: boolean;
  isRest: boolean;
  trainingNames: string[];
  /** empty=无计划;planned=有计划;rest=休息日;completed=已完成;missed=未完成(3.1.9) */
  state: "empty" | "planned" | "rest" | "completed" | "missed";
}

export interface CycleWeekView {
  cycleId: string;
  weekIndex: number;
  totalWeeks: number;
  days: WeekDayView[];
}

/**
 * 某周期第 weekIndex 个自然周的每天视图(3.1.2 周列表)。
 * 周窗口与周期区间取交集(首末周可能不足 7 天);weekIndex 自动夹取到 [1, totalWeeks]。
 */
export async function getCycleWeek(
  userId: string,
  cycleId: string,
  weekIndex: number,
  today?: string,
): Promise<CycleWeekView | null> {
  const [cycle] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.id, cycleId),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  if (!cycle) return null;

  const t = today ?? serverToday();
  const totalWeeks = cycleWeeks(cycle.startDate, cycle.endDate);
  const idx = Math.min(Math.max(1, weekIndex), totalWeeks);
  const weekStart = addDays(weekStartOf(cycle.startDate), (idx - 1) * 7);
  const weekEnd = addDays(weekStart, 6);
  // 周窗口 ∩ 周期区间
  const lo = weekStart > cycle.startDate ? weekStart : cycle.startDate;
  const hi = weekEnd < cycle.endDate ? weekEnd : cycle.endDate;
  const dates: string[] = [];
  for (let d = lo; d <= hi; d = addDays(d, 1)) dates.push(d);

  const dayRows = await db
    .select()
    .from(trainingDays)
    .where(
      and(eq(trainingDays.cycleId, cycle.id), between(trainingDays.date, weekStart, weekEnd)),
    );
  const dayIds = dayRows.map((d) => d.id);

  const [trainingRows, sessions, marks] = await Promise.all([
    dayIds.length > 0
      ? db
          .select({ id: trainings.id, trainingDayId: trainings.trainingDayId, name: trainings.name })
          .from(trainings)
          .where(inArray(trainings.trainingDayId, dayIds))
          .orderBy(trainings.sortOrder)
      : Promise.resolve([]),
    db
      .select({ trainingId: trainingSessions.trainingId, status: trainingSessions.status })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          between(trainingSessions.date, weekStart, weekEnd),
        ),
      ),
    db
      .select({ date: dayMarks.date })
      .from(dayMarks)
      .where(
        and(
          eq(dayMarks.userId, userId),
          eq(dayMarks.kind, "missed"),
          between(dayMarks.date, weekStart, weekEnd),
        ),
      ),
  ]);

  const dayByDate = new Map(dayRows.map((d) => [d.date, d]));
  const dateByDayId = new Map(dayRows.map((d) => [d.id, d.date]));
  const namesByDate = new Map<string, string[]>();
  for (const tr of trainingRows) {
    const date = dateByDayId.get(tr.trainingDayId);
    if (!date) continue;
    const list = namesByDate.get(date) ?? [];
    list.push(tr.name);
    namesByDate.set(date, list);
  }

  // 完成判定(3.1.9):当天任一训练有"已完成"session
  const completedTrainingIds = new Set(
    sessions.filter((s) => s.status === "已完成").map((s) => s.trainingId),
  );
  const completedDates = new Set(
    trainingRows
      .filter((tr) => completedTrainingIds.has(tr.id))
      .map((tr) => dateByDayId.get(tr.trainingDayId) ?? ""),
  );
  const missedDates = new Set(marks.map((m) => m.date));

  const days: WeekDayView[] = dates.map((date) => {
    const day = dayByDate.get(date);
    const names = namesByDate.get(date) ?? [];
    const isPast = date < t;
    const isToday = date === t;

    let state: WeekDayView["state"] = "empty";
    if (day?.isRest) {
      state = "rest";
    } else if (completedDates.has(date)) {
      state = "completed";
    } else if (isPast) {
      // 过期未执行的计划日自动记"未完成"(3.1.9);手动标记同理;无计划的历史日为空
      state = names.length > 0 || missedDates.has(date) ? "missed" : "empty";
    } else {
      state = names.length > 0 ? "planned" : "empty";
    }

    const [, m, d] = date.split("-");
    return {
      date,
      weekday: weekdayCN(date),
      dayLabel: `${Number(m)}月${Number(d)}日`,
      isToday,
      isPast,
      isRest: day?.isRest ?? false,
      trainingNames: names,
      state,
    };
  });

  return { cycleId: cycle.id, weekIndex: idx, totalWeeks, days };
}

/* ============================================================
 * 读:日详情(日编辑页数据源)
 * ============================================================ */

export interface DayTrainingView {
  id: string;
  name: string;
  muscleGroup: string | null;
  itemCount: number;
}

export interface DayDetailView {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  date: string;
  weekIndex: number;
  weekday: string;
  dayLabel: string;
  isRest: boolean;
  /** date < today:历史日期只读(3.1.5) */
  readonly: boolean;
  trainings: DayTrainingView[];
}

/** 日编辑页数据:某周期某日的训练卡列表(含动作数概要) */
export async function getDayDetail(
  userId: string,
  cycleId: string,
  date: string,
  today?: string,
): Promise<DayDetailView | null> {
  const [cycle] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.id, cycleId),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  if (!cycle || date < cycle.startDate || date > cycle.endDate) return null;

  const [day] = await db
    .select()
    .from(trainingDays)
    .where(and(eq(trainingDays.cycleId, cycle.id), eq(trainingDays.date, date)))
    .limit(1);

  const rows =
    day &&
    (await db
      .select({
        id: trainings.id,
        name: trainings.name,
        muscleGroup: trainings.muscleGroup,
        itemCount: sql<number>`count(${trainingItems.id})`,
      })
      .from(trainings)
      .leftJoin(trainingItems, eq(trainingItems.trainingId, trainings.id))
      .where(eq(trainings.trainingDayId, day.id))
      .groupBy(trainings.id, trainings.name, trainings.muscleGroup, trainings.sortOrder)
      .orderBy(trainings.sortOrder));

  const [, m, d] = date.split("-");
  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    cycleStatus: cycle.status,
    date,
    weekIndex: weekIndexOf(date, cycle.startDate),
    weekday: weekdayCN(date),
    dayLabel: `${Number(m)}月${Number(d)}日`,
    isRest: day?.isRest ?? false,
    readonly: date < (today ?? serverToday()),
    trainings: (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      muscleGroup: r.muscleGroup,
      itemCount: Number(r.itemCount),
    })),
  };
}

/* ============================================================
 * 写:追加训练 / 改删训练 / 休息日
 * ============================================================ */

export type DayMutationReason =
  | "NOT_FOUND"
  | "DATE_OUT_OF_RANGE"
  | "PAST_DATE"
  | "IS_REST"
  | "HAS_RECORDS";

export type DayMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: DayMutationReason };

/** 追加当日训练(3.1.5 一天多训练追加制;重复添加为追加,不提示覆盖) */
export async function addTrainingToDay(input: {
  userId: string;
  cycleId: string;
  date: string;
  name: string;
  muscleGroups: string[];
  today?: string;
}): Promise<DayMutationResult<Training>> {
  const cycle = await findCycle(input.userId, input.cycleId);
  if (!cycle) return { ok: false, reason: "NOT_FOUND" };
  if (input.date < cycle.startDate || input.date > cycle.endDate) {
    return { ok: false, reason: "DATE_OUT_OF_RANGE" };
  }
  if (input.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }

  // day 不存在则建;已是休息日的行不可直接添加(先取消休息日)
  const [day] = await db
    .insert(trainingDays)
    .values({ cycleId: cycle.id, date: input.date })
    .onConflictDoUpdate({
      target: [trainingDays.cycleId, trainingDays.date],
      set: { date: input.date },
    })
    .returning();
  if (day.isRest) return { ok: false, reason: "IS_REST" };

  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${trainings.sortOrder}), 0)` })
    .from(trainings)
    .where(eq(trainings.trainingDayId, day.id));

  const [training] = await db
    .insert(trainings)
    .values({
      trainingDayId: day.id,
      name: input.name,
      muscleGroup: input.muscleGroups.join("+"),
      sortOrder: Number(maxSort) + 1,
    })
    .returning();
  return { ok: true, data: training };
}

/** 编辑训练名/部位(仅未来日期) */
export async function updateTraining(input: {
  userId: string;
  trainingId: string;
  name?: string;
  muscleGroups?: string[];
  today?: string;
}): Promise<DayMutationResult<Training>> {
  const row = await findTraining(input.userId, input.trainingId);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.day.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }

  const [updated] = await db
    .update(trainings)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.muscleGroups !== undefined ? { muscleGroup: input.muscleGroups.join("+") } : {}),
    })
    .where(eq(trainings.id, input.trainingId))
    .returning();
  return { ok: true, data: updated };
}

/**
 * 删除计划训练(3.1.11 修改只影响未来):
 * 物理删(training_items 随计划消亡,无软删设计);
 * 已有 session 引用的训练不可删(历史保留),训练执行页(WORKOUT-011)接入后走软删。
 */
export async function deleteTraining(input: {
  userId: string;
  trainingId: string;
  today?: string;
}): Promise<DayMutationResult<null>> {
  const row = await findTraining(input.userId, input.trainingId);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.day.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }

  const [ref] = await db
    .select({ id: trainingSessions.id })
    .from(trainingSessions)
    .where(eq(trainingSessions.trainingId, input.trainingId))
    .limit(1);
  if (ref) return { ok: false, reason: "HAS_RECORDS" };

  await db.batch([
    db.delete(trainingItems).where(eq(trainingItems.trainingId, input.trainingId)),
    db.delete(trainings).where(eq(trainings.id, input.trainingId)),
  ]);
  return { ok: true, data: null };
}

/**
 * 设/取消休息日(3.1.5):
 * - 设:仅未来(含今天);已有计划训练一并移除(历史记录不受影响),有 session 引用时拒绝
 * - 取消:isRest 置 false;day 行不存在时幂等成功
 */
export async function setDayRest(input: {
  userId: string;
  cycleId: string;
  date: string;
  isRest: boolean;
  today?: string;
}): Promise<DayMutationResult<null>> {
  const cycle = await findCycle(input.userId, input.cycleId);
  if (!cycle) return { ok: false, reason: "NOT_FOUND" };
  if (input.date < cycle.startDate || input.date > cycle.endDate) {
    return { ok: false, reason: "DATE_OUT_OF_RANGE" };
  }
  if (input.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }

  const [day] = await db
    .select()
    .from(trainingDays)
    .where(and(eq(trainingDays.cycleId, cycle.id), eq(trainingDays.date, input.date)))
    .limit(1);

  if (!input.isRest) {
    if (!day) return { ok: true, data: null };
    await db.update(trainingDays).set({ isRest: false }).where(eq(trainingDays.id, day.id));
    return { ok: true, data: null };
  }

  if (!day) {
    await db.insert(trainingDays).values({ cycleId: cycle.id, date: input.date, isRest: true });
    return { ok: true, data: null };
  }
  if (day.isRest) return { ok: true, data: null }; // 幂等

  // 移除当天计划训练(先查 session 引用,历史保留)
  const dayTrainings = await db
    .select({ id: trainings.id })
    .from(trainings)
    .where(eq(trainings.trainingDayId, day.id));
  if (dayTrainings.length > 0) {
    const ids = dayTrainings.map((t) => t.id);
    const [ref] = await db
      .select({ id: trainingSessions.id })
      .from(trainingSessions)
      .where(inArray(trainingSessions.trainingId, ids))
      .limit(1);
    if (ref) return { ok: false, reason: "HAS_RECORDS" };

    await db.batch([
      db.delete(trainingItems).where(inArray(trainingItems.trainingId, ids)),
      db.delete(trainings).where(eq(trainings.trainingDayId, day.id)),
    ]);
  }

  await db.update(trainingDays).set({ isRest: true }).where(eq(trainingDays.id, day.id));
  return { ok: true, data: null };
}

/* ============================================================
 * 内部
 * ============================================================ */

async function findCycle(userId: string, cycleId: string) {
  const [cycle] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.id, cycleId),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  return cycle ?? null;
}

/** 训练归属链:training → day → cycle(校验 user 归属) */
async function findTraining(userId: string, trainingId: string) {
  const [row] = await db
    .select({ training: trainings, day: trainingDays })
    .from(trainings)
    .innerJoin(trainingDays, eq(trainings.trainingDayId, trainingDays.id))
    .innerJoin(trainingCycles, eq(trainingDays.cycleId, trainingCycles.id))
    .where(
      and(
        eq(trainings.id, trainingId),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}
