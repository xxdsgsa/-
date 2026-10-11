/**
 * POST /api/days/:date/set-rest —— 设/取消休息日(PRD 3.1.5 / TECH 3.3)
 *
 * 仅未来(含今天)可切换;设休息日时已有计划训练一并移除(历史记录不受影响),
 * 二次确认由前端承担。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
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
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { date } = await ctx.params;
  if (!z.string().regex(DATE_RE).safeParse(date).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "日期不合法" } },
      { status: 400 },
    );
  }

  const { data, error: parseError } = await parseJsonBody(
    req,
    bodySchema,
    "表单数据不合法",
  );
  if (parseError) return parseError;

  const result = await setDayRest({
    userId,
    cycleId: data.cycleId,
    date,
    isRest: data.isRest,
    today: data.today,
  });
  if (!result.ok) {
    return dayError(result.reason);
  }

  return NextResponse.json({ success: true, data: {} });
}
