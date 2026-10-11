/**
 * POST /api/onboarding/complete(PRD 3.6.6 第 4 步【完成设置】)
 *
 * 服务端权威:营养目标服务端计算,仅手动项用客户端值;
 * 必填字段/范围全量 Zod 校验(表单校验防不住直调)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { completeOnboarding } from "@/lib/db/queries/onboarding";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  gender: z.enum(["male", "female"]),
  age: z.number().int().min(13).max(80),
  heightCm: z.number().int().min(100).max(250).nullish(),
  weightKg: z.number().min(20).max(300),
  bodyFatPct: z.number().min(3).max(60).nullish(),
  goalType: z.enum(["muscle_gain", "fat_loss", "recomp", "health"]),
  targetWeightKg: z.number().min(20).max(300).nullish(),
  targetDate: z.string().regex(DATE_RE).nullish(),
  weeklyTrainingDays: z.number().int().min(0).max(7),
  today: z.string().regex(DATE_RE),
  manualGoals: z
    .object({
      calories: z.number().int().min(800).max(8000),
      protein: z.number().int().min(20).max(400),
      carbs: z.number().int().min(0).max(800),
      fat: z.number().int().min(10).max(200),
      waterMl: z.number().int().min(500).max(6000),
    })
    .partial()
    .optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  // 仅当日校验(UTC+8 宽松:不为未来、不早于昨日)
  const todayServer = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  if (parsed.data.today > todayServer || parsed.data.today < yesterday) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "日期超出当日范围" } },
      { status: 400 },
    );
  }

  const goals = await completeOnboarding({
    userId,
    ...parsed.data,
    heightCm: parsed.data.heightCm ?? null,
    bodyFatPct: parsed.data.bodyFatPct ?? null,
    targetWeightKg: parsed.data.targetWeightKg ?? null,
    targetDate: parsed.data.targetDate ?? null,
  });

  return NextResponse.json({ success: true, data: { goals } });
}
