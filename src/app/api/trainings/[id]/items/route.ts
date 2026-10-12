/**
 * POST /api/trainings/:id/items —— 追加动作项(PRD 3.1.7 / TECH 3.3)
 *
 * 参数:组数*(≥1) / 次数*(≥1) / 目标重量(可选,≥0) / 休息时间(可选,默认90秒) / 备注(可选)。
 * 同一动作可重复添加(3.2.9);追加序即动作顺序①②③。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api-days";
import { parseJsonBody } from "@/lib/api/parse";
import { addTrainingItem } from "@/lib/db/queries/training-items";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEIGHT_RE = /^\d{1,4}(\.\d)?$/;

const itemBodySchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(99),
  reps: z.number().int().min(1).max(999),
  targetWeight: z.string().regex(WEIGHT_RE).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  note: z.string().trim().max(200).nullable().optional(),
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

  const { data, error: parseError } = await parseJsonBody(req, itemBodySchema);
  if (parseError) return parseError;

  const result = await addTrainingItem({
    userId,
    trainingId: id,
    exerciseId: data.exerciseId,
    body: {
      sets: data.sets,
      reps: data.reps,
      targetWeight: data.targetWeight ?? null,
      restSeconds: data.restSeconds ?? 90,
      note: data.note ?? null,
    },
    today: data.today,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: { item: result.data } }, { status: 201 });
}
