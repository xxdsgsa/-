/**
 * POST /api/water-logs —— 饮水快捷记录(PRD 3.7.5/3.10)
 * body: { amountMl: 1~2000 };仅当日(服务端 UTC+8),无补记(3.10.3)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { serverToday } from "@/lib/date";
import { addWaterLog, getTodayWaterTotal } from "@/lib/db/queries/water";

const bodySchema = z.object({
  amountMl: z.number().int().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "请输入正确的饮水量" } },
      { status: 400 },
    );
  }

  const today = serverToday();
  await addWaterLog({
    userId,
    date: today,
    amountMl: parsed.data.amountMl,
  });
  const todayTotalMl = await getTodayWaterTotal(userId, today);

  return NextResponse.json(
    { success: true, data: { todayTotalMl } },
    { status: 201 },
  );
}
