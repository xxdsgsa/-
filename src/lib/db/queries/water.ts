/**
 * 饮水记录服务层(PRD 3.10;首页快捷打卡 3.7.5)
 * 仅当日记录,无补记(3.10.3);date 由调用方传入(服务端 UTC+8)。
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { serverToday } from "@/lib/date";

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

/* ============================================================
 * 今日记录列表(3.10.2)
 * ============================================================ */

export interface WaterLogView {
  id: string;
  amountMl: number;
  /** ISO 串,客户端 toLocaleTimeString */
  createdAt: string;
}

export async function listWaterLogs(
  userId: string,
  date: string,
): Promise<WaterLogView[]> {
  const rows = await db
    .select({ id: waterLogs.id, amountMl: waterLogs.amountMl, loggedAt: waterLogs.loggedAt })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)))
    .orderBy(desc(waterLogs.loggedAt), desc(waterLogs.id));
  return rows.map((r) => ({
    id: r.id,
    amountMl: r.amountMl,
    createdAt: r.loggedAt.toISOString(),
  }));
}

/** 删除单条(限当日,3.10.3);不存在返回 false */
export async function deleteWaterLog(
  userId: string,
  logId: string,
  today?: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: waterLogs.id, date: waterLogs.date })
    .from(waterLogs)
    .where(and(eq(waterLogs.id, logId), eq(waterLogs.userId, userId)))
    .limit(1);
  if (!row) return false;
  const t = today ?? serverToday();
  if (row.date !== t) return false; // 非当日不可删(历史保留)
  await db.delete(waterLogs).where(eq(waterLogs.id, logId));
  return true;
}
