/**
 * /api/diet/items —— 添加饮食条目(PRD 3.8.3 / NUTRITION-001/003)
 * POST { date, mealType, foodId, grams } 校验 7 天补记窗口与重量 1~5000
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { DATE_RE } from "@/lib/api/params";
import { dietError } from "@/lib/api-diet";
import { parseJsonBody } from "@/lib/api/parse";
import { addDietItem, MEAL_TYPES } from "@/lib/db/queries/diet";

/** 重量(g/ml):1~5000,最多 1 位小数(3.8.3) */
const grams = z
  .number()
  .min(1)
  .max(5000)
  .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数");

const bodySchema = z.object({
  date: z.string().regex(DATE_RE),
  mealType: z.enum(MEAL_TYPES),
  foodId: z.string().uuid(),
  grams,
  today: z.string().regex(DATE_RE).optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(
    req,
    bodySchema,
    "请输入 1~5000 之间的数值",
  );
  if (parseError) return parseError;

  const r = await addDietItem({
    userId,
    date: data.date,
    mealType: data.mealType,
    foodId: data.foodId,
    grams: data.grams,
    today: data.today,
  });
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json(
    { success: true, data: { item: { id: r.data.id } } },
    { status: 201 },
  );
}
