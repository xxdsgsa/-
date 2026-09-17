/**
 * POST /api/supplement-logs —— 补剂打卡(PRD 3.7.6/3.9.3)
 * body: { supplementId, dose? }:剂量默认补剂单次剂量,可覆盖(>0,最多 1 位小数)。
 * 归属校验在服务层(带 user_id);仅当日。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { serverToday } from "@/lib/date";
import { addSupplementLog, getTodaySupplementCount } from "@/lib/db/queries/supplements";

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
      { success: false, error: { code: "VALIDATION_ERROR", message: "请选择补剂并输入正确剂量" } },
      { status: 400 },
    );
  }

  const { supplementId, dose } = parsed.data;
  const today = serverToday();
  const ok = await addSupplementLog({
    userId: session.user.id,
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

  const todayCount = await getTodaySupplementCount(session.user.id, today);
  return NextResponse.json({ success: true, data: { todayCount } }, { status: 201 });
}
