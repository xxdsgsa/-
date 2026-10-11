/**
 * PATCH /api/trainings/:id —— 改训练名/部位;DELETE —— 删计划训练(PRD 3.1.5 / 3.1.11 / TECH 3.3)
 *
 * 仅未来日期可改删(历史只读);删除不影响训练历史(3.1.11),
 * 已有执行记录的训练拒绝删除(409)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api-days";
import { MUSCLE_GROUPS } from "@/lib/cycles";
import { deleteTraining, updateTraining } from "@/lib/db/queries/training-days";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const patchSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  muscleGroups: z
    .array(z.enum(MUSCLE_GROUPS))
    .min(1)
    .refine((arr) => new Set(arr).size === arr.length, { message: "部位不可重复" })
    .optional(),
  today: z.string().regex(DATE_RE).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "训练 ID 不合法" } },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.name && !parsed.data.muscleGroups)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const result = await updateTraining({
    userId,
    trainingId: id,
    name: parsed.data.name,
    muscleGroups: parsed.data.muscleGroups,
    today: parsed.data.today,
  });
  if (!result.ok) {
    return dayError(result.reason);
  }

  return NextResponse.json({ success: true, data: { training: result.data } });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "训练 ID 不合法" } },
      { status: 400 },
    );
  }

  // today 由查询参数透传(客户端日历日,ADR-12)
  const today = new URL(req.url).searchParams.get("today") ?? undefined;
  if (today !== undefined && !z.string().regex(DATE_RE).safeParse(today).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "日期不合法" } },
      { status: 400 },
    );
  }

  const result = await deleteTraining({ userId, trainingId: id, today });
  if (!result.ok) {
    return dayError(result.reason);
  }

  return NextResponse.json({ success: true, data: {} });
}
