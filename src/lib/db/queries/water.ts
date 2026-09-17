/**
 * 饮水记录服务层(PRD 3.10;首页快捷打卡 3.7.5)
 * 仅当日记录,无补记(3.10.3);date 由调用方传入(服务端 UTC+8)。
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { waterLogs } from "@/db/schema";

export async function addWaterLog(input: {
  userId: string;
  date: string;
  amountMl: number;
}) {
  await db.insert(waterLogs).values({
    userId: input.userId,
    date: input.date,
    amountMl: input.amountMl,
  });
}

/** 当日饮水总量(ml) */
export async function getTodayWaterTotal(userId: string, date: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${waterLogs.amountMl}), 0)` })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)));
  return Number(row?.total ?? 0);
}
