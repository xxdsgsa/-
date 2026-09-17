/**
 * POST /api/body-weight —— 记录体重(PRD 3.7.7/3.2.5/3.2.6)
 * body: { weightKg: 20~300(1 位小数), overwrite? }。
 * 同日已有记录且未确认覆盖 → 409 ALREADY_EXISTS(客户端二次确认后重发)。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
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
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "请输入正确体重(20~300kg)" } },
      { status: 400 },
    );
  }

  const { weightKg, overwrite } = parsed.data;
  const today = serverToday();

  const existing = await getBodyWeightForDate(session.user.id, today);
  if (existing && !overwrite) {
    return NextResponse.json(
      { success: false, error: { code: "ALREADY_EXISTS", message: "今天已经记录过体重,是否覆盖?" } },
      { status: 409 },
    );
  }

  const record = await upsertBodyWeight({
    userId: session.user.id,
    date: today,
    weightKg: String(weightKg),
  });

  return NextResponse.json(
    { success: true, data: { record } },
    { status: existing ? 200 : 201 },
  );
}
