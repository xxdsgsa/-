/**
 * /api/supplements —— 补剂管理(PRD 3.9.2)
 * GET  列表(我的补剂,按名称序;软删过滤)
 * POST 新建(body: name / unit / dose / dailyTarget?)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { SUPPLEMENT_UNITS, createSupplement, listSupplements } from "@/lib/db/queries/supplements";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(20),
  unit: z.enum(SUPPLEMENT_UNITS),
  dose: z
    .number()
    .positive()
    .max(9999)
    .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数"),
  dailyTarget: z.number().int().min(1).max(10).nullable().optional(),
});

export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const list = await listSupplements(userId);
  return NextResponse.json({ success: true, data: { supplements: list } });
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const created = await createSupplement(userId, data);
  return NextResponse.json({ success: true, data: { supplement: { id: created.id } } }, { status: 201 });
}
