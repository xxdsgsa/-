/**
 * POST /api/training-items/:id/move —— 动作排序(PRD 3.1.7)
 *
 * body: { direction: "up" | "down" };V1 以按钮代长按拖拽,顶端/底端幂等成功。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api-days";
import { moveTrainingItem } from "@/lib/db/queries/training-items";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  direction: z.enum(["up", "down"]),
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const result = await moveTrainingItem({
    userId,
    itemId: id,
    direction: parsed.data.direction,
    today: parsed.data.today,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null });
}
