/**
 * POST /api/body-weight —— 记录体重(PRD 3.7.7/3.2.5/3.2.6)
 * body: { weightKg: 20~300(1 位小数), overwrite? }。
 * 同日已有记录且未确认覆盖 → 409 ALREADY_EXISTS(客户端二次确认后重发)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { serverToday } from "@/lib/date";
import {
  getBodyWeightForDate,
  upsertBodyWeight,
} from "@/lib/db/queries/body-weight";

const bodySchema = z.object({
  weightKg: z
    .number()
    .min(20)
    .max(300)
    .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数"),
  overwrite: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(
    req,
    bodySchema,
    "请输入正确体重(20~300kg)",
  );
  if (parseError) return parseError;
  const { weightKg, overwrite } = data;
  const today = serverToday();

  const existing = await getBodyWeightForDate(userId, today);
  if (existing && !overwrite) {
    return NextResponse.json(
      { success: false, error: { code: "ALREADY_EXISTS", message: "今天已经记录过体重,是否覆盖?" } },
      { status: 409 },
    );
  }

  const record = await upsertBodyWeight({
    userId,
    date: today,
    weightKg: String(weightKg),
  });

  return NextResponse.json(
    { success: true, data: { record } },
    { status: existing ? 200 : 201 },
  );
}
