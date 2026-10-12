/**
 * POST /api/trainings/:id/start —— 开始训练(PRD 3.1.9/3.1.10)
 *
 * 仅当天训练可开始;本训练进行中幂等返回(resumed=true,中断恢复);
 * 其他训练进行中 → 409 SESSION_CONFLICT;已完成 → 409 SESSION_DONE。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { DATE_RE } from "@/lib/api/params";
import { dayError } from "@/lib/api-days";
import { startSession } from "@/lib/db/queries/training-sessions";

const bodySchema = z.object({
  today: z.string().regex(DATE_RE).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const result = await startSession({
    userId,
    trainingId: id,
    today: parsed.data.today,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
