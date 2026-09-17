/**
 * POST /api/water-logs —— 饮水快捷记录(PRD 3.7.5/3.10)
 * body: { amountMl: 1~2000 };仅当日(服务端 UTC+8),无补记(3.10.3)。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { serverToday } from "@/lib/date";
import { addWaterLog, getTodayWaterTotal } from "@/lib/db/queries/water";

const bodySchema = z.object({
  amountMl: z.number().int().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "请输入正确的饮水量" } },
      { status: 400 },
    );
  }

  const today = serverToday();
  await addWaterLog({
    userId: session.user.id,
    date: today,
    amountMl: parsed.data.amountMl,
  });
  const todayTotalMl = await getTodayWaterTotal(session.user.id, today);

  return NextResponse.json(
    { success: true, data: { todayTotalMl } },
    { status: 201 },
  );
}
