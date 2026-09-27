/**
 * POST /api/days/:date/set-rest —— 设/取消休息日(PRD 3.1.5 / TECH 3.3)
 *
 * 仅未来(含今天)可切换;设休息日时已有计划训练一并移除(历史记录不受影响),
 * 二次确认由前端承担。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { dayError } from "@/lib/api-days";
import { setDayRest } from "@/lib/db/queries/training-days";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  cycleId: z.string().uuid(),
  isRest: z.boolean(),
  today: z.string().regex(DATE_RE).optional(),
});

type Ctx = { params: Promise<{ date: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const { date } = await ctx.params;
  if (!z.string().regex(DATE_RE).safeParse(date).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "日期不合法" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const result = await setDayRest({
    userId: session.user.id,
    cycleId: parsed.data.cycleId,
    date,
    isRest: parsed.data.isRest,
    today: parsed.data.today,
  });
  if (!result.ok) {
    return dayError(result.reason);
  }

  return NextResponse.json({ success: true, data: {} });
}
