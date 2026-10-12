/**
 * POST /api/sessions/:id/finish —— 结束训练(PRD 3.1.10/3.2.7)
 *
 * 提前结束(前端弹窗确认后)或全部动作完成自动触发;幂等。
 * 结束后当天状态由四态判定已有逻辑自动流转(3.1.9)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api/days";
import { finishSession } from "@/lib/db/queries/training-sessions";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const result = await finishSession({ userId, sessionId: id });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: result.data });
}
