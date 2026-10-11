/**
 * /api/training-items/:id —— 动作项改删(PRD 3.1.7 / TECH 3.3)
 *
 * PATCH   编辑动作参数(组数/次数/目标重量/休息时间/备注;null 表示清空可选字段)
 * DELETE  删除动作(已被逐组记录引用时 409,历史保留)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api-days";
import { deleteTrainingItem, updateTrainingItem } from "@/lib/db/queries/training-items";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEIGHT_RE = /^\d{1,4}(\.\d)?$/;

const bodySchema = z.object({
  sets: z.number().int().min(1).max(99).optional(),
  reps: z.number().int().min(1).max(999).optional(),
  targetWeight: z.string().regex(WEIGHT_RE).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  note: z.string().trim().max(200).nullable().optional(),
  today: z.string().regex(DATE_RE).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

function badId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (badId(id)) {
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

  const result = await updateTrainingItem({
    userId,
    itemId: id,
    body: {
      ...(parsed.data.sets !== undefined ? { sets: parsed.data.sets } : {}),
      ...(parsed.data.reps !== undefined ? { reps: parsed.data.reps } : {}),
      ...(parsed.data.targetWeight !== undefined ? { targetWeight: parsed.data.targetWeight } : {}),
      ...(parsed.data.restSeconds !== undefined ? { restSeconds: parsed.data.restSeconds } : {}),
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
    },
    today: parsed.data.today,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: { item: result.data } });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (badId(id)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const today = req.nextUrl.searchParams.get("today") ?? undefined;
  const result = await deleteTrainingItem({ userId, itemId: id, today });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null });
}
