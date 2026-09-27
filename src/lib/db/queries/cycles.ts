/**
 * 训练周期服务层(PRD 3.1.4 / 3.1.11)
 *
 * 状态机:未开始 →(到达开始日期)进行中 →(结束日期过后)已结束;"进行中"全用户唯一,
 * 由部分唯一索引 training_cycles_one_active_per_user 兜底。
 * "修改只影响未来":周期为计划元数据,训练历史(sessions/set_logs)不受增删改影响;
 * 删除一律软删,历史数据完整保留。
 */
import { and, desc, eq, isNull, lt, lte } from "drizzle-orm";

import { serverToday } from "@/lib/date";

import { db } from "@/db";
import { trainingCycles, type TrainingCycle } from "@/db/schema";

export interface CreateCycleInput {
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** 客户端"今日"(设备时区日历日,ADR-12);缺省按服务端 UTC+8 */
  today?: string;
  /** 确认"结束并激活新周期"后置 true(3.1.4) */
  force?: boolean;
}

export type CreateCycleResult =
  | { ok: true; cycle: TrainingCycle }
  | { ok: false; activeCycle: TrainingCycle };

export async function createCycle(input: CreateCycleInput): Promise<CreateCycleResult> {
  const today = input.today ?? serverToday();
  const willBeActive = input.startDate <= today;

  if (willBeActive) {
    const active = await getActiveCycle(input.userId);
    if (active && !input.force) {
      return { ok: false, activeCycle: active };
    }
    if (active) {
      // 结束旧周期 + 建新周期,db.batch 单事务原子执行(neon-http 无事务 API)
      const [, inserted] = await db.batch([
        db
          .update(trainingCycles)
          .set({ status: "已结束" })
          .where(eq(trainingCycles.id, active.id)),
        db
          .insert(trainingCycles)
          .values({
            userId: input.userId,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
            status: "进行中",
          })
          .returning(),
      ]);
      return { ok: true, cycle: inserted[0] };
    }
  }

  const status = input.startDate > today ? "未开始" : "进行中";
  const [cycle] = await db
    .insert(trainingCycles)
    .values({
      userId: input.userId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status,
    })
    .returning();
  return { ok: true, cycle };
}

/** 当前进行中的周期(首页训练卡数据源,PRD 3.7.3) */
export async function getActiveCycle(userId: string) {
  const [cycle] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.userId, userId),
        eq(trainingCycles.status, "进行中"),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .orderBy(desc(trainingCycles.startDate))
    .limit(1);
  return cycle ?? null;
}

/** 用户的周期列表(训练页顶栏切换,PRD 3.1.2) */
export async function listCycles(userId: string) {
  return db
    .select()
    .from(trainingCycles)
    .where(and(eq(trainingCycles.userId, userId), isNull(trainingCycles.deletedAt)))
    .orderBy(desc(trainingCycles.startDate));
}

export interface UpdateCycleInput {
  userId: string;
  id: string;
  /** 日期编辑成对提交(编辑表单始终三者齐发;仅改名时不校验日期) */
  name?: string;
  startDate?: string;
  endDate?: string;
  today?: string;
}

export type UpdateCycleResult =
  | { ok: true; cycle: TrainingCycle }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "ACTIVE_CONFLICT"; activeCycle: TrainingCycle };

/** 编辑周期(3.1.4):按新日期 + 今日重导状态;重导出"进行中"且他周期占用时返回冲突 */
export async function updateCycle(input: UpdateCycleInput): Promise<UpdateCycleResult> {
  const [cycle] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.id, input.id),
        eq(trainingCycles.userId, input.userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  if (!cycle) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const today = input.today ?? serverToday();
  const startDate = input.startDate ?? cycle.startDate;
  const endDate = input.endDate ?? cycle.endDate;
  const nextStatus = deriveCycleStatus(startDate, endDate, today);

  if (nextStatus === "进行中" && cycle.status !== "进行中") {
    const active = await getActiveCycle(input.userId);
    if (active) {
      return { ok: false, reason: "ACTIVE_CONFLICT", activeCycle: active };
    }
  }

  const [updated] = await db
    .update(trainingCycles)
    .set({
      name: input.name ?? cycle.name,
      startDate,
      endDate,
      status: nextStatus,
    })
    .where(
      and(
        eq(trainingCycles.id, input.id),
        eq(trainingCycles.userId, input.userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .returning();
  return { ok: true, cycle: updated };
}

/** 软删周期(3.1.11:计划数据隐藏,训练历史不动) */
export async function deleteCycle(userId: string, id: string): Promise<boolean> {
  const [cycle] = await db
    .select({ status: trainingCycles.status })
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.id, id),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  if (!cycle) return false;

  await db
    .update(trainingCycles)
    .set({
      deletedAt: new Date(),
      // 软删的"进行中"必须同时让出唯一索引位(部分唯一索引不排除软删行)
      ...(cycle.status === "进行中" ? { status: "已结束" } : {}),
    })
    .where(
      and(
        eq(trainingCycles.id, id),
        eq(trainingCycles.userId, userId),
        isNull(trainingCycles.deletedAt),
      ),
    );
  return true;
}

export interface ActivateCycleInput {
  userId: string;
  id: string;
  force?: boolean;
}

export type ActivateCycleResult =
  | { ok: true; cycle: TrainingCycle }
  | { ok: false; reason: "NOT_FOUND" | "FINISHED" }
  | { ok: false; reason: "ACTIVE_CONFLICT"; activeCycle: TrainingCycle };

/** 手动激活周期(3.1.4):已有进行中 → 冲突,前端确认后带 force 结束旧并激活本周期 */
export async function activateCycle(input: ActivateCycleInput): Promise<ActivateCycleResult> {
  const [cycle] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.id, input.id),
        eq(trainingCycles.userId, input.userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .limit(1);
  if (!cycle) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (cycle.status === "已结束") {
    // 生命周期终点,不可复活(PRD 3.1.4 状态图)
    return { ok: false, reason: "FINISHED" };
  }
  if (cycle.status === "进行中") {
    // 幂等:已是进行中直接返回
    return { ok: true, cycle };
  }

  const active = await getActiveCycle(input.userId);
  if (active && !input.force) {
    return { ok: false, reason: "ACTIVE_CONFLICT", activeCycle: active };
  }

  if (active) {
    const [, updated] = await db.batch([
      db
        .update(trainingCycles)
        .set({ status: "已结束" })
        .where(eq(trainingCycles.id, active.id)),
      db
        .update(trainingCycles)
        .set({ status: "进行中" })
        .where(
          and(
            eq(trainingCycles.id, input.id),
            eq(trainingCycles.userId, input.userId),
            isNull(trainingCycles.deletedAt),
          ),
        )
        .returning(),
    ]);
    return { ok: true, cycle: updated[0] };
  }

  const [updated] = await db
    .update(trainingCycles)
    .set({ status: "进行中" })
    .where(
      and(
        eq(trainingCycles.id, input.id),
        eq(trainingCycles.userId, input.userId),
        isNull(trainingCycles.deletedAt),
      ),
    )
    .returning();
  return { ok: true, cycle: updated };
}

/**
 * 生命周期自动流转(3.1.4):过期"进行中"自动结束 → 到点"未开始"自动激活。
 * 训练页/dashboard 加载时调用,幂等;多候补时激活开始日期最近者。
 */
export async function refreshCycleStatuses(userId: string): Promise<void> {
  const today = serverToday();

  await db
    .update(trainingCycles)
    .set({ status: "已结束" })
    .where(
      and(
        eq(trainingCycles.userId, userId),
        eq(trainingCycles.status, "进行中"),
        isNull(trainingCycles.deletedAt),
        lt(trainingCycles.endDate, today),
      ),
    );

  // 仅当无进行中周期时才自动激活(部分唯一索引约束 + "同一时间仅一个启用")
  const active = await getActiveCycle(userId);
  if (active) return;

  const [due] = await db
    .select()
    .from(trainingCycles)
    .where(
      and(
        eq(trainingCycles.userId, userId),
        eq(trainingCycles.status, "未开始"),
        isNull(trainingCycles.deletedAt),
        lte(trainingCycles.startDate, today),
      ),
    )
    .orderBy(desc(trainingCycles.startDate))
    .limit(1);
  if (due) {
    await db
      .update(trainingCycles)
      .set({ status: "进行中" })
      .where(eq(trainingCycles.id, due.id));
  }
}

/** 状态推导(纯函数,创建/编辑/自动流转共用):开始在未来→未开始;结束已过→已结束;否则进行中 */
export function deriveCycleStatus(startDate: string, endDate: string, today: string) {
  if (startDate > today) return "未开始";
  if (endDate < today) return "已结束";
  return "进行中";
}
