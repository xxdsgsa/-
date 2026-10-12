/**
 * POST /api/sessions/:id/sets —— 逐组记录(PRD 3.1.10)
 *
 * body: { trainingItemId, setIndex(1-based), weight?, reps? };实际值由前端默认带入计划值。
 * 重复提交幂等覆盖;session 已结束 → 400 NOT_IN_PROGRESS。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api/days";
import { parseJsonBody } from "@/lib/api/parse";
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
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const result = await logSet({
    userId,
    sessionId: id,
    trainingItemId: data.trainingItemId,
    setIndex: data.setIndex,
    weight: data.weight ?? null,
    reps: data.reps ?? null,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null }, { status: 201 });
}
