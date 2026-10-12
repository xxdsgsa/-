/**
 * /api/supplements/[id] —— 补剂改删(PRD 3.9.2)
 * PATCH   编辑(name / unit / dose / dailyTarget)
 * DELETE  软删(历史记录走快照保留,3.9.2)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { parseUuidParam } from "@/lib/api/params";
import {
  SUPPLEMENT_UNITS,
  deleteSupplement,
  updateSupplement,
} from "@/lib/db/queries/supplements";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  unit: z.enum(SUPPLEMENT_UNITS).optional(),
  dose: z
    .number()
    .positive()
    .max(9999)
    .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数")
    .optional(),
  dailyTarget: z.number().int().min(1).max(10).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const result = await updateSupplement(userId, id, data);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "补剂不存在或已删除" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const result = await deleteSupplement(userId, id);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "补剂不存在或已删除" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: null });
}
