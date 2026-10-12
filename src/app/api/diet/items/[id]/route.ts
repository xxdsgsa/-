/**
 * /api/diet/items/[id] —— 饮食条目改删(PRD 3.8.5 / NUTRITION-003)
 * PATCH  改重量(读取时按快照重算营养;超 7 天窗口只读)
 * DELETE 删条目,删除后统计重算
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { DATE_RE, parseUuidParam } from "@/lib/api/params";
import { dietError } from "@/lib/api/diet";
import { parseJsonBody } from "@/lib/api/parse";
import { deleteDietItem, updateDietItem } from "@/lib/db/queries/diet";

const grams = z
  .number()
  .min(1)
  .max(5000)
  .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数");

const bodySchema = z.object({
  grams,
  today: z.string().regex(DATE_RE).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const { data, error: parseError } = await parseJsonBody(
    req,
    bodySchema,
    "请输入 1~5000 之间的数值",
  );
  if (parseError) return parseError;

  const r = await updateDietItem({
    userId,
    itemId: id,
    grams: data.grams,
    today: data.today,
  });
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const today = req.nextUrl.searchParams.get("today") ?? undefined;
  const r = await deleteDietItem({ userId, itemId: id, today });
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}
