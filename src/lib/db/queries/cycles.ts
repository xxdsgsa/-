/**
 * 训练周期服务层(PRD 3.1.4)
 *
 * 状态推导:startDate > today → 未开始;否则进行中。
 * "每用户仅一个进行中"由部分唯一索引兜底(TECH 2.2)。
 */
import { desc, eq, and, isNull } from "drizzle-orm";

import { serverToday } from "@/lib/date";

import { db } from "@/db";
import { trainingCycles } from "@/db/schema";

export interface CreateCycleInput {
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** 客户端"今日"(设备时区日历日,ADR-12);缺省按服务端 UTC+8 */
  today?: string;
}

export async function createCycle(input: CreateCycleInput) {
  const today = input.today ?? serverToday();
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
  return cycle;
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
