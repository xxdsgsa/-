/**
 * 计划动作项服务层(PRD 3.1.7)
 *
 * - 训练编辑页数据:训练详情 + 动作列表(按 sort_order,含动作名)
 * - 写操作:追加动作(同一动作可重复添加,3.2.9)、改参数、删动作、上移/下移
 * - 与计划训练同级校验:归属链 user→cycle→day→training;历史日期只读;
 *   删除动作若已被逐组记录引用则拒绝(修改只影响未来,3.1.11)
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { serverToday } from "@/lib/date";

import { db } from "@/db";
import {
  exercises,
  setLogs,
  trainingDays,
  trainingItems,
  trainings,
  trainingCycles,
  type TrainingItem,
} from "@/db/schema";

import { exerciseAccessible } from "./exercises";
import type { DayMutationResult } from "./training-days";

/* ============================================================
 * 读:训练详情(训练编辑页数据源)
 * ============================================================ */

export interface TrainingItemView {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  /** numeric(10,1) 字符串,如 "80.0";未填为 null */
  targetWeight: string | null;
  restSeconds: number;
  note: string | null;
  sortOrder: number;
}

export interface TrainingDetailView {
  trainingId: string;
  cycleId: string;
  cycleName: string;
  date: string;
  /** "9月27日" */
  dayLabel: string;
  name: string;
  muscleGroup: string | null;
  /** date < today:历史日期只读(3.1.5) */
  readonly: boolean;
  items: TrainingItemView[];
}

/** 训练编辑页数据:训练名/部位 + 动作参数列表 */
export async function getTrainingDetail(
  userId: string,
  trainingId: string,
  today?: string,
): Promise<TrainingDetailView | null> {
  const chain = await findTraining(userId, trainingId);
  if (!chain) return null;
  const { training, day, cycle } = chain;

  const rows = await db
    .select({
      id: trainingItems.id,
      exerciseId: trainingItems.exerciseId,
      exerciseName: exercises.name,
      sets: trainingItems.sets,
      reps: trainingItems.reps,
      targetWeight: trainingItems.targetWeight,
      restSeconds: trainingItems.restSeconds,
      note: trainingItems.note,
      sortOrder: trainingItems.sortOrder,
    })
    .from(trainingItems)
    .innerJoin(exercises, eq(trainingItems.exerciseId, exercises.id))
    .where(eq(trainingItems.trainingId, training.id))
    .orderBy(asc(trainingItems.sortOrder), asc(trainingItems.id));

  const [, m, d] = day.date.split("-");
  return {
    trainingId: training.id,
    cycleId: cycle.id,
    cycleName: cycle.name,
    date: day.date,
    dayLabel: `${Number(m)}月${Number(d)}日`,
    name: training.name,
    muscleGroup: training.muscleGroup,
    readonly: day.date < (today ?? serverToday()),
    items: rows,
  };
}

/* ============================================================
 * 写:追加 / 改 / 删 / 排序
 * ============================================================ */

export interface TrainingItemInput {
  sets: number;
  reps: number;
  targetWeight?: string | null;
  restSeconds?: number;
  note?: string | null;
}

/** 追加动作到训练(3.1.7 保存后动作加入训练;排序按追加顺序) */
export async function addTrainingItem(input: {
  userId: string;
  trainingId: string;
  exerciseId: string;
  body: TrainingItemInput;
  today?: string;
}): Promise<DayMutationResult<TrainingItem>> {
  const chain = await findTraining(input.userId, input.trainingId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.day.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }
  if (chain.day.isRest) return { ok: false, reason: "IS_REST" };
  if (!(await exerciseAccessible(input.userId, input.exerciseId))) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${trainingItems.sortOrder}), 0)` })
    .from(trainingItems)
    .where(eq(trainingItems.trainingId, input.trainingId));

  const b = input.body;
  const [item] = await db
    .insert(trainingItems)
    .values({
      trainingId: input.trainingId,
      exerciseId: input.exerciseId,
      sets: b.sets,
      reps: b.reps,
      targetWeight: b.targetWeight ?? null,
      restSeconds: b.restSeconds ?? 90,
      note: b.note ?? null,
      sortOrder: Number(maxSort) + 1,
    })
    .returning();
  return { ok: true, data: item };
}

/** 编辑动作参数(3.1.7 ⋮菜单"编辑") */
export async function updateTrainingItem(input: {
  userId: string;
  itemId: string;
  body: Partial<TrainingItemInput>;
  today?: string;
}): Promise<DayMutationResult<TrainingItem>> {
  const chain = await findItem(input.userId, input.itemId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.day.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }
  if (chain.day.isRest) return { ok: false, reason: "IS_REST" };

  const b = input.body;
  const [updated] = await db
    .update(trainingItems)
    .set({
      ...(b.sets !== undefined ? { sets: b.sets } : {}),
      ...(b.reps !== undefined ? { reps: b.reps } : {}),
      ...(b.targetWeight !== undefined ? { targetWeight: b.targetWeight } : {}),
      ...(b.restSeconds !== undefined ? { restSeconds: b.restSeconds } : {}),
      ...(b.note !== undefined ? { note: b.note } : {}),
    })
    .where(eq(trainingItems.id, input.itemId))
    .returning();
  return { ok: true, data: updated };
}

/**
 * 删除动作(3.1.7:弹窗确认;删除后立即刷新列表)。
 * 物理删(计划数据无软删设计);已被逐组记录引用时拒绝,历史保留。
 */
export async function deleteTrainingItem(input: {
  userId: string;
  itemId: string;
  today?: string;
}): Promise<DayMutationResult<null>> {
  const chain = await findItem(input.userId, input.itemId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.day.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }

  const [ref] = await db
    .select({ id: setLogs.id })
    .from(setLogs)
    .where(eq(setLogs.trainingItemId, input.itemId))
    .limit(1);
  if (ref) return { ok: false, reason: "HAS_RECORDS" };

  await db.delete(trainingItems).where(eq(trainingItems.id, input.itemId));
  return { ok: true, data: null };
}

/**
 * 上移/下移(3.1.7 动作排序;V1 以按钮代拖拽,顺序即追加序 ①②③)。
 * 取全量按序重排,顺带修复历史脏 sortOrder。
 */
export async function moveTrainingItem(input: {
  userId: string;
  itemId: string;
  direction: "up" | "down";
  today?: string;
}): Promise<DayMutationResult<null>> {
  const chain = await findItem(input.userId, input.itemId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.day.date < (input.today ?? serverToday())) {
    return { ok: false, reason: "PAST_DATE" };
  }

  const rows = await db
    .select({ id: trainingItems.id })
    .from(trainingItems)
    .where(eq(trainingItems.trainingId, chain.training.id))
    .orderBy(asc(trainingItems.sortOrder), asc(trainingItems.id));

  const idx = rows.findIndex((r) => r.id === input.itemId);
  const swap = input.direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= rows.length) {
    return { ok: true, data: null }; // 已在顶端/底端,幂等成功
  }
  [rows[idx], rows[swap]] = [rows[swap], rows[idx]];

  // rows 必非空(目标项在其中);全量重排顺带修复历史脏 sortOrder
  const [first, ...rest] = rows.map((r, i) =>
    db.update(trainingItems).set({ sortOrder: i + 1 }).where(eq(trainingItems.id, r.id)),
  );
  await db.batch([first, ...rest]);
  return { ok: true, data: null };
}

/* ============================================================
 * 内部:归属链校验(user → cycle → day → training/item)
 * ============================================================ */

interface TrainingChain {
  training: typeof trainings.$inferSelect;
  day: typeof trainingDays.$inferSelect;
  cycle: typeof trainingCycles.$inferSelect;
}

async function findTraining(userId: string, trainingId: string): Promise<TrainingChain | null> {
  const [row] = await db
    .select({ training: trainings, day: trainingDays, cycle: trainingCycles })
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

async function findItem(userId: string, itemId: string) {
  const [row] = await db
    .select({
      item: trainingItems,
      training: trainings,
      day: trainingDays,
      cycle: trainingCycles,
    })
    .from(trainingItems)
    .innerJoin(trainings, eq(trainingItems.trainingId, trainings.id))
    .innerJoin(trainingDays, eq(trainings.trainingDayId, trainingDays.id))
    .innerJoin(trainingCycles, eq(trainingDays.cycleId, trainingCycles.id))
    .where(
      and(
        eq(trainingItems.id, itemId),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}
