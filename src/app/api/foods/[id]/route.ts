/**
 * /api/foods/[id] —— 自定义食物改删(PRD 3.8.4)
 * PATCH  编辑我的食物(官方 403,他人 404)
 * DELETE 软删我的食物;历史记录走条目快照不受影响
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { dietError } from "@/lib/api-diet";
import { deleteFood, updateFood } from "@/lib/db/queries/diet";

const UUID_RE = /^[0-9a-f-]{36}$/;

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

async function session() {
  return auth.api.getSession({ headers: await headers() }).catch(() => null);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
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

  const r = await updateFood(s.user.id, id, parsed.data);
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const r = await deleteFood(s.user.id, id);
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}
