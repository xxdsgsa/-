/**
 * 体重记录服务层(PRD 3.2.4/3.2.5/3.2.6,STAT-005)
 * 唯一 (user_id, date):同日重复由 API 层先 409 让用户确认,确认后 upsert 覆盖。
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bodyWeightRecords } from "@/db/schema";

export async function getBodyWeightForDate(userId: string, date: string) {
  const [row] = await db
    .select()
    .from(bodyWeightRecords)
    .where(and(eq(bodyWeightRecords.userId, userId), eq(bodyWeightRecords.date, date)))
    .limit(1);
  return row ?? null;
}

/** 同日覆盖 upsert(3.2.6;调用方需已获得覆盖确认) */
export async function upsertBodyWeight(input: {
  userId: string;
  date: string;
  weightKg: string;
}) {
  const [row] = await db
    .insert(bodyWeightRecords)
    .values({
      userId: input.userId,
      date: input.date,
      weightKg: input.weightKg,
    })
    .onConflictDoUpdate({
      target: [bodyWeightRecords.userId, bodyWeightRecords.date],
      set: { weightKg: input.weightKg },
    })
    .returning();
  return row;
}
