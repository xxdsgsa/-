/**
 * POST /api/water-logs —— 饮水快捷记录(PRD 3.7.5/3.10)
 * body: { amountMl: 1~2000 };仅当日(服务端 UTC+8),无补记(3.10.3)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { serverToday } from "@/lib/date";
import { addWaterLog, getTodayWaterTotal } from "@/lib/db/queries/water";

const bodySchema = z.object({
  amountMl: z.number().int().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema, "请输入正确的饮水量");
  if (parseError) return parseError;

  const today = serverToday();
  await addWaterLog({
    userId,
    date: today,
    amountMl: data.amountMl,
  });
  const todayTotalMl = await getTodayWaterTotal(userId, today);

  return NextResponse.json(
    { success: true, data: { todayTotalMl } },
    { status: 201 },
  );
}
