/**
 * /api/water-logs —— 饮水记录(PRD 3.10;首页快捷打卡 3.7.5)
 * POST 快捷打卡(+100/+250/+500ml;仅当日)
 * GET  今日记录列表(?date=YYYY-MM-DD,缺省 serverToday)
 * DELETE /api/water-logs/[id] —— 删除单条(限当日,3.10.3)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { DATE_RE } from "@/lib/api/params";
import { parseJsonBody } from "@/lib/api/parse";
import { serverToday } from "@/lib/date";
import { addWaterLog, getTodayWaterTotal, listWaterLogs } from "@/lib/db/queries/water";

const bodySchema = z.object({
  amountMl: z.number().int().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema, "请输入 1~2000 之间的数值");
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

export async function GET(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : serverToday();

  const logs = await listWaterLogs(userId, date);
  const total = await getTodayWaterTotal(userId, date);
  return NextResponse.json({ success: true, data: { logs, total, date } });
}
