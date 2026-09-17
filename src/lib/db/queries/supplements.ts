/**
 * 补剂服务层(PRD 3.9;首页卡片打卡 3.7.6)
 * 打卡 = 引用 + 快照(删除补剂不影响历史,3.9.2);一天可多次,带时间戳。
 */
import { and, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { supplementLogs, supplements } from "@/db/schema";

/** 当日补剂打卡次数(API 响应/卡片同步用) */
export async function getTodaySupplementCount(userId: string, date: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, date)));
  return row?.n ?? 0;
}

/**
 * 补剂打卡(3.9.3):单条 = 补剂 + 覆盖后的单次剂量(默认该补剂的 dose)。
 * 归属校验(带 user_id + 软删除过滤);快照 name/unit/dose。
 */
export async function addSupplementLog(input: {
  userId: string;
  supplementId: string;
  /** 覆盖剂量;缺省用补剂默认单次剂量 */
  dose?: string;
  date: string;
}): Promise<boolean> {
  const [supplement] = await db
    .select()
    .from(supplements)
    .where(
      and(
        eq(supplements.id, input.supplementId),
        eq(supplements.userId, input.userId),
        isNull(supplements.deletedAt),
      ),
    )
    .limit(1);
  if (!supplement) return false;

  await db.insert(supplementLogs).values({
    userId: input.userId,
    supplementId: supplement.id,
    name: supplement.name,
    unit: supplement.unit,
    dose: input.dose ?? supplement.dose,
    date: input.date,
  });
  return true;
}
