/**
 * 训练标记服务层(PRD 3.1.9)
 * 手动"未完成"标记当日可撤销(= 删行);跨日只读。
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { dayMarks } from "@/db/schema";

/** 撤销"今日未训练"标记;返回是否确实删除了一行 */
export async function undoMissedMark(userId: string, date: string): Promise<boolean> {
  const deleted = await db
    .delete(dayMarks)
    .where(and(eq(dayMarks.userId, userId), eq(dayMarks.date, date), eq(dayMarks.kind, "missed")))
    .returning();
  return deleted.length > 0;
}
