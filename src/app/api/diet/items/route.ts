/**
 * /api/diet/items —— 添加饮食条目(PRD 3.8.3 / NUTRITION-001/003)
 * POST { date, mealType, foodId, grams } 校验 7 天补记窗口与重量 1~5000
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { dietError } from "@/lib/api-diet";
import { addDietItem, MEAL_TYPES } from "@/lib/db/queries/diet";

/** 重量(g/ml):1~5000,最多 1 位小数(3.8.3) */
const grams = z
  .number()
  .min(1)
  .max(5000)
  .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数");

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MEAL_TYPES),
  foodId: z.string().uuid(),
  grams,
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "请输入 1~5000 之间的数值" } },
      { status: 400 },
    );
  }

  const r = await addDietItem({
    userId: s.user.id,
    date: parsed.data.date,
    mealType: parsed.data.mealType,
    foodId: parsed.data.foodId,
    grams: parsed.data.grams,
    today: parsed.data.today,
  });
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json(
    { success: true, data: { item: { id: r.data.id } } },
    { status: 201 },
  );
}
