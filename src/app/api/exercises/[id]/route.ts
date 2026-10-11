/**
 * /api/exercises/:id —— 自定义动作改删(PRD 3.1.6 / TECH 3.3)
 *
 * PATCH   编辑我的动作(名称/肌群/备注)
 * DELETE  软删我的动作;官方动作一律 403(官方不可删)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api-days";
import { MUSCLE_GROUPS } from "@/lib/cycles";
import { deleteExercise, updateExercise } from "@/lib/db/queries/exercises";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  muscleGroup: z.enum(MUSCLE_GROUPS).optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

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

  const result = await updateExercise({
    userId,
    exerciseId: id,
    name: parsed.data.name,
    muscleGroup: parsed.data.muscleGroup,
    note: parsed.data.note ?? undefined,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: { exercise: result.data } });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const result = await deleteExercise(userId, id);
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null });
}
