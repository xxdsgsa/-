/**
 * /api/foods —— 食物库(PRD 3.8.3/3.8.4 / TECH 3.3)
 *
 * GET  ?search=  官方+我的食物联合搜索(我的在前,每页 20)
 * POST 新建自定义食物(名称* / 每 100g 四项营养素*),保存至"我的食物"
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { createFood, searchFoods } from "@/lib/db/queries/diet";

const querySchema = z.object({
  search: z.string().trim().max(30).optional(),
});

/** 每 100g 宏量:0~100,最多 1 位小数 */
const per100 = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数");

const bodySchema = z.object({
  name: z.string().trim().min(1).max(30),
  kcalPer100: z.number().int().min(0).max(1000),
  proteinPer100: per100,
  carbsPer100: per100,
  fatPer100: per100,
  isLiquid: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    ...(sp.get("search") ? { search: sp.get("search") } : {}),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "查询参数不合法" } },
      { status: 400 },
    );
  }

  const foods = await searchFoods(userId, parsed.data.search || undefined);
  return NextResponse.json({ success: true, data: { foods } });
}

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

  const food = await createFood(userId, parsed.data);
  return NextResponse.json(
    { success: true, data: { food: { id: food.id, owner: "mine" as const } } },
    { status: 201 },
  );
}
