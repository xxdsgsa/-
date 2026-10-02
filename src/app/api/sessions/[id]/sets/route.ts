/**
 * POST /api/sessions/:id/sets —— 逐组记录(PRD 3.1.10)
 *
 * body: { trainingItemId, setIndex(1-based), weight?, reps? };实际值由前端默认带入计划值。
 * 重复提交幂等覆盖;session 已结束 → 400 NOT_IN_PROGRESS。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { dayError } from "@/lib/api-days";
import { logSet } from "@/lib/db/queries/training-sessions";

const WEIGHT_RE = /^\d{1,4}(\.\d)?$/;

const bodySchema = z.object({
  trainingItemId: z.string().uuid(),
  setIndex: z.number().int().min(1).max(99),
  weight: z.string().regex(WEIGHT_RE).nullable().optional(),
  reps: z.number().int().min(1).max(999).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

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

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
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

  const result = await logSet({
    userId: session.user.id,
    sessionId: id,
    trainingItemId: parsed.data.trainingItemId,
    setIndex: parsed.data.setIndex,
    weight: parsed.data.weight ?? null,
    reps: parsed.data.reps ?? null,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null }, { status: 201 });
}
