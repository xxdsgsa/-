/**
 * /api/supplement-logs —— 补剂打卡(PRD 3.9;首页卡片 3.7.6)
 * POST  打卡(已实现,客户端卡片调用)
 * GET   今日打卡记录列表(日期由 query ?date= 传入,缺省 serverToday)
 * DELETE /api/supplement-logs/[id] —— 删除单条(左滑删除,3.9.3)
 *
 * 归属校验在服务层(带 user_id);仅当日。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { DATE_RE } from "@/lib/api/params";
import { parseJsonBody } from "@/lib/api/parse";
import { serverToday } from "@/lib/date";
import {
  addSupplementLog,
  getTodaySupplementCount,
  listSupplementLogs,
} from "@/lib/db/queries/supplements";

const bodySchema = z.object({
  supplementId: z.string().uuid(),
  dose: z
    .number()
    .positive()
    .max(9999)
    .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数")
    .optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(
    req,
    bodySchema,
    "请选择补剂并输入正确剂量",
  );
  if (parseError) return parseError;
  const { supplementId, dose } = data;
  const today = serverToday();
  const ok = await addSupplementLog({
    userId,
    supplementId,
    dose: dose != null ? String(dose) : undefined,
    date: today,
  });
  if (!ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "补剂不存在或已删除" } },
      { status: 404 },
    );
  }

  const todayCount = await getTodaySupplementCount(userId, today);
  return NextResponse.json({ success: true, data: { todayCount } }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : serverToday();

  const logs = await listSupplementLogs(userId, date);
  return NextResponse.json({ success: true, data: { logs, date } });
}
