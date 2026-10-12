/**
 * 训练执行服务层(PRD 3.1.10 / WORKOUT-011)
 *
 * - 执行视图:训练 + 动作参数 + 进行中 session + 已有逐组记录(中断恢复数据源)
 * - 开始:仅当天训练可执行;本训练已有进行中 session 幂等返回;其他训练进行中 → 409 冲突;
 *   每用户仅一个"进行中"由 DB 部分唯一索引兜底(schema training_sessions_one_in_progress)
 * - 逐组记录:(sessionId, trainingItemId, setIndex) 应用层唯一,重复点击幂等更新
 * - 跳过动作:为剩余未完成组生成 completed=false 行(不动已完成行,3.2.7)
 * - 结束:提前结束或全部完成 → status=已完成 + durationSeconds(3.2.7:完成≥1组记"已完成"由
 *   四态判定已有逻辑自动处理,本层不管)
 * - 总结(3.5)与历史(WORKOUT-007):set_logs 聚合只统计 completed 组;无重量不折算容量;
 *   归属经 session.user_id,不经 cycle(周期删除后历史保留可见,3.1.4/3.2.8)
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { trackRecord } from "@/lib/analytics";
import { weekdayCN } from "@/lib/cycles";
import { serverToday } from "@/lib/date";

import { db } from "@/db";
import { exercises, setLogs, trainingItems, trainingSessions, trainings } from "@/db/schema";

import { findTraining } from "./training-items";

/* ============================================================
 * 读:执行视图(执行页 RSC 数据源)
 * ============================================================ */

export interface SetLogView {
  setIndex: number;
  weight: string | null;
  reps: number | null;
  completed: boolean;
}

export interface ExecutingItemView {
  itemId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  targetWeight: string | null;
  restSeconds: number;
  note: string | null;
  logs: SetLogView[];
}

export interface ExecutionView {
  trainingId: string;
  cycleId: string;
  date: string;
  /** "10月2日" */
  dayLabel: string;
  name: string;
  muscleGroup: string | null;
  /** ready 待开始 / executing 执行中(含中断恢复) / done 已完成 / conflict 其他训练进行中 */
  mode: "ready" | "executing" | "done" | "conflict";
  /** 进行中 session(executing 时必有;startedAt 为 ISO 串,客户端计时起点) */
  session: { id: string; startedAt: string } | null;
  /** 已完成 session id(done 模式"查看总结"入口) */
  doneSessionId: string | null;
  /** conflict 时的进行中训练(跳转目标) */
  conflict: { trainingId: string; trainingName: string } | null;
  items: ExecutingItemView[];
}

/** 执行页数据:mode 判定 + 动作逐组记录 */
export async function getExecutionView(
  userId: string,
  trainingId: string,
): Promise<ExecutionView | null> {
  const chain = await findTraining(userId, trainingId);
  if (!chain) return null;
  const { training, day, cycle } = chain;

  const [items, mySessions, inProgress] = await Promise.all([
    db
      .select({
        itemId: trainingItems.id,
        exerciseName: exercises.name,
        sets: trainingItems.sets,
        reps: trainingItems.reps,
        targetWeight: trainingItems.targetWeight,
        restSeconds: trainingItems.restSeconds,
        note: trainingItems.note,
      })
      .from(trainingItems)
      .innerJoin(exercises, eq(trainingItems.exerciseId, exercises.id))
      .where(eq(trainingItems.trainingId, training.id))
      .orderBy(asc(trainingItems.sortOrder), asc(trainingItems.id)),
    db
      .select()
      .from(trainingSessions)
      .where(
        and(eq(trainingSessions.trainingId, training.id), eq(trainingSessions.userId, userId)),
      ),
    db
      .select({ trainingId: trainingSessions.trainingId })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.status, "进行中")))
      .limit(1),
  ]);

  const mineInProgress = mySessions.find((s) => s.status === "进行中");
  const mineDone = mySessions.find((s) => s.status === "已完成");
  const otherInProgress =
    !mineInProgress && inProgress.length > 0 && inProgress[0].trainingId !== training.id
      ? inProgress[0]
      : null;

  let mode: ExecutionView["mode"] = "ready";
  if (mineInProgress) mode = "executing";
  else if (otherInProgress) mode = "conflict";
  else if (mineDone) mode = "done";

  let conflict: ExecutionView["conflict"] = null;
  if (otherInProgress) {
    const [row] = await db
      .select({ name: trainings.name })
      .from(trainings)
      .where(eq(trainings.id, otherInProgress.trainingId))
      .limit(1);
    conflict = { trainingId: otherInProgress.trainingId, trainingName: row?.name ?? "" };
  }

  // executing:带逐组记录
  let logsByItem = new Map<string, SetLogView[]>();
  if (mineInProgress) {
    const logs = await db
      .select({
        trainingItemId: setLogs.trainingItemId,
        setIndex: setLogs.setIndex,
        actualWeight: setLogs.actualWeight,
        actualReps: setLogs.actualReps,
        completed: setLogs.completed,
      })
      .from(setLogs)
      .where(eq(setLogs.sessionId, mineInProgress.id))
      .orderBy(asc(setLogs.setIndex));
    logsByItem = logs.reduce((map, l) => {
      const arr = map.get(l.trainingItemId) ?? [];
      arr.push({
        setIndex: l.setIndex,
        weight: l.actualWeight,
        reps: l.actualReps,
        completed: l.completed,
      });
      map.set(l.trainingItemId, arr);
      return map;
    }, new Map<string, SetLogView[]>());
  }

  const [, m, d] = day.date.split("-");
  return {
    trainingId: training.id,
    cycleId: cycle.id,
    date: day.date,
    dayLabel: `${Number(m)}月${Number(d)}日`,
    name: training.name,
    muscleGroup: training.muscleGroup,
    mode,
    session: mineInProgress
      ? { id: mineInProgress.id, startedAt: mineInProgress.startedAt.toISOString() }
      : null,
    doneSessionId: mineDone?.id ?? null,
    conflict,
    items: items.map((i) => ({
      itemId: i.itemId,
      exerciseName: i.exerciseName,
      sets: i.sets,
      reps: i.reps,
      targetWeight: i.targetWeight,
      restSeconds: i.restSeconds,
      note: i.note,
      logs: logsByItem.get(i.itemId) ?? [],
    })),
  };
}

/* ============================================================
 * 读:训练总结页(3.5 / WORKOUT-007 数据源)
 * ============================================================ */

export interface SummaryItemView {
  itemId: string;
  name: string;
  /** 计划组数 */
  plannedSets: number;
  reps: number;
  /** 完成组数(≤ plannedSets) */
  completedSets: number;
}

export interface SessionSummaryView {
  sessionId: string;
  trainingId: string;
  trainingName: string;
  /** 进行中 / 已完成 */
  status: string;
  date: string;
  dayLabel: string;
  weekday: string;
  durationSeconds: number | null;
  /** 动作总数 */
  totalItems: number;
  /** 全部组完成的动作数(3.5.2 完成动作数分子) */
  completedItems: number;
  /** 完成组总数(3.5.3:未完成组不计入) */
  completedSets: number;
  /** Σ 实际重量×实际次数(仅完成组;无重量不折算 → null) */
  volume: number | null;
  items: SummaryItemView[];
}

/**
 * 训练总结页数据(3.5.3):逐组记录为唯一数据源,只读不可编辑。
 * 归属校验:user 直接持有 session(user_id),不经 cycle(周期软删后历史仍可查,3.1.4)。
 */
export async function getSessionSummary(
  userId: string,
  sessionId: string,
): Promise<SessionSummaryView | null> {
  const [row] = await db
    .select({
      sessionId: trainingSessions.id,
      trainingId: trainingSessions.trainingId,
      date: trainingSessions.date,
      status: trainingSessions.status,
      durationSeconds: trainingSessions.durationSeconds,
      trainingName: trainings.name,
    })
    .from(trainingSessions)
    .innerJoin(trainings, eq(trainingSessions.trainingId, trainings.id))
    .where(and(eq(trainingSessions.id, sessionId), eq(trainingSessions.userId, userId)))
    .limit(1);
  if (!row) return null;

  const [items, logs] = await Promise.all([
    db
      .select({
        itemId: trainingItems.id,
        name: exercises.name,
        plannedSets: trainingItems.sets,
        reps: trainingItems.reps,
      })
      .from(trainingItems)
      .innerJoin(exercises, eq(trainingItems.exerciseId, exercises.id))
      .where(eq(trainingItems.trainingId, row.trainingId))
      .orderBy(asc(trainingItems.sortOrder), asc(trainingItems.id)),
    db
      .select({
        trainingItemId: setLogs.trainingItemId,
        completedSets: sql<number>`cast(count(*) filter (where ${setLogs.completed}) as int)`,
        volume: sql<number>`cast(coalesce(sum(${setLogs.actualWeight} * ${setLogs.actualReps}) filter (where ${setLogs.completed} and ${setLogs.actualWeight} is not null), 0) as double precision)`,
      })
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionId))
      .groupBy(setLogs.trainingItemId),
  ]);

  const logMap = new Map(logs.map((l) => [l.trainingItemId, l]));
  const itemViews = items.map((it) => ({
    itemId: it.itemId,
    name: it.name,
    plannedSets: it.plannedSets,
    reps: it.reps,
    completedSets: logMap.get(it.itemId)?.completedSets ?? 0,
  }));
  const totalVolume = logs.reduce((sum, l) => sum + l.volume, 0);

  const [, m, d] = row.date.split("-");
  return {
    sessionId: row.sessionId,
    trainingId: row.trainingId,
    trainingName: row.trainingName,
    status: row.status,
    date: row.date,
    dayLabel: `${Number(m)}月${Number(d)}日`,
    weekday: weekdayCN(row.date),
    durationSeconds: row.durationSeconds,
    totalItems: itemViews.length,
    completedItems: itemViews.filter((it) => it.completedSets >= it.plannedSets).length,
    completedSets: itemViews.reduce((sum, it) => sum + it.completedSets, 0),
    volume: totalVolume > 0 ? totalVolume : null,
    items: itemViews,
  };
}

/* ============================================================
 * 读:训练历史列表(WORKOUT-007)
 * ============================================================ */

export interface HistoryEntryView {
  sessionId: string;
  date: string;
  dayLabel: string;
  weekday: string;
  trainingName: string;
  durationSeconds: number | null;
  completedSets: number;
  /** 容量(无重量记录为 null,展示时省略) */
  volume: number | null;
}

/**
 * 训练历史:已完成 sessions 按日期倒序(WORKOUT-007)。
 * 历史只读(3.2.8);不经 cycle 归属,周期删除后记录仍保留可见。
 */
export async function listHistorySessions(
  userId: string,
  limit = 100,
): Promise<HistoryEntryView[]> {
  const sessions = await db
    .select({
      sessionId: trainingSessions.id,
      date: trainingSessions.date,
      durationSeconds: trainingSessions.durationSeconds,
      trainingName: trainings.name,
    })
    .from(trainingSessions)
    .innerJoin(trainings, eq(trainingSessions.trainingId, trainings.id))
    .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.status, "已完成")))
    .orderBy(desc(trainingSessions.date), desc(trainingSessions.startedAt))
    .limit(limit);

  if (sessions.length === 0) return [];

  const stats = await db
    .select({
      sessionId: setLogs.sessionId,
      completedSets: sql<number>`cast(count(*) filter (where ${setLogs.completed}) as int)`,
      volume: sql<number>`cast(coalesce(sum(${setLogs.actualWeight} * ${setLogs.actualReps}) filter (where ${setLogs.completed} and ${setLogs.actualWeight} is not null), 0) as double precision)`,
    })
    .from(setLogs)
    .where(inArray(setLogs.sessionId, sessions.map((s) => s.sessionId)))
    .groupBy(setLogs.sessionId);

  const statMap = new Map(stats.map((s) => [s.sessionId, s]));
  return sessions.map((s) => {
    const stat = statMap.get(s.sessionId);
    const [, m, d] = s.date.split("-");
    return {
      sessionId: s.sessionId,
      date: s.date,
      dayLabel: `${Number(m)}月${Number(d)}日`,
      weekday: weekdayCN(s.date),
      trainingName: s.trainingName,
      durationSeconds: s.durationSeconds,
      completedSets: stat?.completedSets ?? 0,
      volume: stat && stat.volume > 0 ? stat.volume : null,
    };
  });
}

/* ============================================================
 * 写:开始 / 记组 / 跳过 / 结束
 * ============================================================ */

export type SessionMutationReason =
  | "NOT_FOUND"
  | "NOT_TODAY"
  | "SESSION_DONE"
  | "SESSION_CONFLICT"
  | "NOT_IN_PROGRESS";

export type SessionMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: SessionMutationReason };

/** 开始训练:仅当天可执行;进行中幂等;其他训练进行中 → 冲突;已完成 → 不可重复 */
export async function startSession(input: {
  userId: string;
  trainingId: string;
  today?: string;
}): Promise<SessionMutationResult<{ sessionId: string; resumed: boolean }>> {
  const chain = await findTraining(input.userId, input.trainingId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.day.date !== (input.today ?? serverToday())) {
    return { ok: false, reason: "NOT_TODAY" };
  }
  if (chain.day.isRest) return { ok: false, reason: "NOT_FOUND" };

  const [mine] = await db
    .select({ id: trainingSessions.id, status: trainingSessions.status })
    .from(trainingSessions)
    .where(
      and(eq(trainingSessions.trainingId, input.trainingId), eq(trainingSessions.userId, input.userId)),
    )
    .limit(1);
  if (mine?.status === "进行中") return { ok: true, data: { sessionId: mine.id, resumed: true } };
  if (mine?.status === "已完成") return { ok: false, reason: "SESSION_DONE" };

  const [other] = await db
    .select({ id: trainingSessions.id })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, input.userId), eq(trainingSessions.status, "进行中")))
    .limit(1);
  if (other) return { ok: false, reason: "SESSION_CONFLICT" };

  const [session] = await db
    .insert(trainingSessions)
    .values({
      userId: input.userId,
      trainingId: input.trainingId,
      date: chain.day.date,
      status: "进行中",
    })
    .returning({ id: trainingSessions.id });
  return { ok: true, data: { sessionId: session.id, resumed: false } };
}

/** 完成一组:实际值默认由前端带入计划值;重复提交幂等覆盖 */
export async function logSet(input: {
  userId: string;
  sessionId: string;
  trainingItemId: string;
  setIndex: number;
  weight?: string | null;
  reps?: number | null;
}): Promise<SessionMutationResult<null>> {
  const chain = await findSessionChain(input.userId, input.sessionId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.session.status !== "进行中") return { ok: false, reason: "NOT_IN_PROGRESS" };

  const [item] = await db
    .select({ id: trainingItems.id, sets: trainingItems.sets })
    .from(trainingItems)
    .where(
      and(
        eq(trainingItems.id, input.trainingItemId),
        eq(trainingItems.trainingId, chain.session.trainingId),
      ),
    )
    .limit(1);
  if (!item || input.setIndex < 1 || input.setIndex > item.sets) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const [existing] = await db
    .select({ id: setLogs.id })
    .from(setLogs)
    .where(
      and(
        eq(setLogs.sessionId, input.sessionId),
        eq(setLogs.trainingItemId, input.trainingItemId),
        eq(setLogs.setIndex, input.setIndex),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(setLogs)
      .set({
        actualWeight: input.weight ?? null,
        actualReps: input.reps ?? null,
        completed: true,
        completedAt: new Date(),
      })
      .where(eq(setLogs.id, existing.id));
  } else {
    await db.insert(setLogs).values({
      sessionId: input.sessionId,
      trainingItemId: input.trainingItemId,
      setIndex: input.setIndex,
      actualWeight: input.weight ?? null,
      actualReps: input.reps ?? null,
      completed: true,
      completedAt: new Date(),
    });
  }
  return { ok: true, data: null };
}

/** 跳过动作(3.1.10):剩余未完成组生成 completed=false 行,已完成组不动 */
export async function skipItem(input: {
  userId: string;
  sessionId: string;
  trainingItemId: string;
}): Promise<SessionMutationResult<null>> {
  const chain = await findSessionChain(input.userId, input.sessionId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.session.status !== "进行中") return { ok: false, reason: "NOT_IN_PROGRESS" };

  const [item] = await db
    .select({ id: trainingItems.id, sets: trainingItems.sets })
    .from(trainingItems)
    .where(
      and(
        eq(trainingItems.id, input.trainingItemId),
        eq(trainingItems.trainingId, chain.session.trainingId),
      ),
    )
    .limit(1);
  if (!item) return { ok: false, reason: "NOT_FOUND" };

  const doneIndexes = new Set(
    (
      await db
        .select({ setIndex: setLogs.setIndex })
        .from(setLogs)
        .where(
          and(
            eq(setLogs.sessionId, input.sessionId),
            eq(setLogs.trainingItemId, input.trainingItemId),
          ),
        )
    ).map((r) => r.setIndex),
  );

  const missing = [];
  for (let i = 1; i <= item.sets; i++) {
    if (!doneIndexes.has(i)) {
      missing.push({
        sessionId: input.sessionId,
        trainingItemId: input.trainingItemId,
        setIndex: i,
        completed: false,
      });
    }
  }
  if (missing.length > 0) {
    const [first, ...rest] = missing;
    await db.batch([db.insert(setLogs).values(first), ...rest.map((r) => db.insert(setLogs).values(r))]);
  }
  return { ok: true, data: null };
}

/**
 * 结束训练(提前结束 3.2.7 / 全部完成自动触发):
 * status→已完成,endedAt=now,durationSeconds=起止差。幂等:已完成直接成功。
 */
export async function finishSession(input: {
  userId: string;
  sessionId: string;
}): Promise<SessionMutationResult<{ durationSeconds: number }>> {
  const chain = await findSessionChain(input.userId, input.sessionId);
  if (!chain) return { ok: false, reason: "NOT_FOUND" };
  if (chain.session.status === "已完成") {
    const elapsed = Math.floor(
      (chain.session.endedAt!.getTime() - chain.session.startedAt.getTime()) / 1000,
    );
    return { ok: true, data: { durationSeconds: elapsed } };
  }

  const now = new Date();
  const duration = Math.max(0, Math.floor((now.getTime() - chain.session.startedAt.getTime()) / 1000));
  await db
    .update(trainingSessions)
    .set({ status: "已完成", endedAt: now, durationSeconds: duration })
    .where(eq(trainingSessions.id, input.sessionId));
  await trackRecord(input.userId, "training_session", {
    session_id: input.sessionId,
    date: chain.session.date,
    duration_seconds: duration,
  });
  return { ok: true, data: { durationSeconds: duration } };
}

/* ============================================================
 * 内部
 * ============================================================ */

/** session 归属链:session → user(直接持有,无需经 training) */
async function findSessionChain(userId: string, sessionId: string) {
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.id, sessionId), eq(trainingSessions.userId, userId)))
    .limit(1);
  return row ? { session: row } : null;
}
