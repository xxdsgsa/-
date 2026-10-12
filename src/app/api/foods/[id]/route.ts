/**
 * /api/foods/[id] —— 自定义食物改删(PRD 3.8.4)
 * PATCH  编辑我的食物(官方 403,他人 404)
 * DELETE 软删我的食物;历史记录走条目快照不受影响
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dietError } from "@/lib/api/diet";
import { parseJsonBody } from "@/lib/api/parse";
import { parseUuidParam } from "@/lib/api/params";
import { deleteFood, updateFood } from "@/lib/db/queries/diet";

const per100 = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数");

const bodySchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  kcalPer100: z.number().int().min(0).max(1000).optional(),
  proteinPer100: per100.optional(),
  carbsPer100: per100.optional(),
  fatPer100: per100.optional(),
  isLiquid: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const r = await updateFood(userId, id, data);
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const r = await deleteFood(userId, id);
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}
