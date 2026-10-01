/**
 * 动作库服务层(PRD 3.1.6 / WORKOUT-009)
 *
 * - 官方动作(owner_id IS NULL,80 条种子)与我的动作同表;软删(deleted_at)统一排除
 * - 搜索:名称模糊;筛选:肌群;列表"我的"在前,"官方"在后
 * - 自定义动作:新建(名称/肌群/备注);官方动作不可改删(403 由 api 层映射)
 */
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";

import type { MuscleGroup } from "@/lib/cycles";

import { db } from "@/db";
import { exercises, type Exercise } from "@/db/schema";

export interface ExerciseView {
  id: string;
  name: string;
  /** 力量 / 有氧 / 自重 / 拉伸 */
  category: string;
  muscleGroup: string;
  note: string | null;
  owner: "official" | "mine";
}

/** 自定义动作可见域:官方 + 本人,未软删 */
function visibleScope(userId: string) {
  return and(
    isNull(exercises.deletedAt),
    or(isNull(exercises.ownerId), eq(exercises.ownerId, userId)),
  );
}

/** 动作库列表(3.1.6:搜索框 + 肌群分类;我的在前官方在后) */
export async function listExercises(
  userId: string,
  opts?: { search?: string; muscleGroup?: MuscleGroup },
): Promise<ExerciseView[]> {
  const conditions = [visibleScope(userId)];
  if (opts?.muscleGroup) conditions.push(eq(exercises.muscleGroup, opts.muscleGroup));
  if (opts?.search) conditions.push(ilike(exercises.name, `%${opts.search}%`));

  const rows = await db
    .select()
    .from(exercises)
    .where(and(...conditions))
    .orderBy(asc(exercises.name));

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      muscleGroup: r.muscleGroup,
      note: r.note,
      owner: r.ownerId === null ? ("official" as const) : ("mine" as const),
    }))
    .sort((a, b) => (a.owner === b.owner ? 0 : a.owner === "mine" ? -1 : 1));
}

export type ExerciseMutationReason = "NOT_FOUND" | "OFFICIAL_EXERCISE";

export type ExerciseMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ExerciseMutationReason };

/** 新建自定义动作(3.1.6:名称* / 肌群* / 备注可选;保存后加入"我的动作") */
export async function createExercise(input: {
  userId: string;
  name: string;
  muscleGroup: MuscleGroup;
  note?: string;
}): Promise<Exercise> {
  const [row] = await db
    .insert(exercises)
    .values({
      ownerId: input.userId,
      name: input.name,
      category: "力量",
      muscleGroup: input.muscleGroup,
      note: input.note ?? null,
    })
    .returning();
  return row;
}

/** 编辑自定义动作(官方动作 403,TECH 3.3) */
export async function updateExercise(input: {
  userId: string;
  exerciseId: string;
  name?: string;
  muscleGroup?: MuscleGroup;
  note?: string;
}): Promise<ExerciseMutationResult<Exercise>> {
  const reason = await classifyExercise(input.userId, input.exerciseId);
  if (reason !== "MINE") return { ok: false, reason };

  const [updated] = await db
    .update(exercises)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.muscleGroup !== undefined ? { muscleGroup: input.muscleGroup } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    })
    .where(eq(exercises.id, input.exerciseId))
    .returning();
  return { ok: true, data: updated };
}

/** 软删自定义动作(官方动作 403;已被计划引用不影响——行保留,FK 完整) */
export async function deleteExercise(
  userId: string,
  exerciseId: string,
): Promise<ExerciseMutationResult<null>> {
  const reason = await classifyExercise(userId, exerciseId);
  if (reason !== "MINE") return { ok: false, reason };

  await db
    .update(exercises)
    .set({ deletedAt: new Date() })
    .where(eq(exercises.id, exerciseId));
  return { ok: true, data: null };
}

/**
 * 动作归属判定:本人 → MINE;官方 → OFFICIAL_EXERCISE(403);
 * 不存在/他人动作 → NOT_FOUND(404,不泄露存在性)。
 */
async function classifyExercise(
  userId: string,
  exerciseId: string,
): Promise<"MINE" | "OFFICIAL_EXERCISE" | "NOT_FOUND"> {
  const [row] = await db
    .select({ ownerId: exercises.ownerId })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), isNull(exercises.deletedAt)))
    .limit(1);
  if (!row) return "NOT_FOUND";
  if (row.ownerId === null) return "OFFICIAL_EXERCISE";
  return row.ownerId === userId ? "MINE" : "NOT_FOUND";
}

/** 校验动作对用户可用(官方或本人,未软删);供动作项写入前置检查 */
export async function exerciseAccessible(
  userId: string,
  exerciseId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), visibleScope(userId)))
    .limit(1);
  return row !== undefined;
}
