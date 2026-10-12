/**
 * 饮食记录服务层(PRD 3.8 / NUTRITION-001~004)
 *
 * - 日视图:四餐次条目 + 四项营养汇总 × nutrition_goals 对照(3.8.6)
 * - 食物库:官方+我的联合搜索(我的在前,每页 20);自定义食物增改删
 *   (官方 403;历史记录走条目快照,改删食物不影响已记录数据,3.8.4)
 * - 条目:添加(写入快照冗余)/改重量(读取时按快照重算)/删除;
 *   补记窗口 = 过去 7 天含今日(3.8.8),超窗只读
 * - 营养计算统一:grams × per100 / 100;单项取整展示,总计先求和再取整
 */
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { trackRecord } from "@/lib/analytics";
import { weekdayCN } from "@/lib/cycles";
import { serverToday } from "@/lib/date";

import { db } from "@/db";
import { dietItems, foods, type DietItem, type Food } from "@/db/schema";
import { getNutritionGoals } from "./onboarding";

/** 饮食域写操作结果(reason 经 api-diet.ts 映射为 HTTP) */
export type DietMutationResult<T> = { ok: true; data: T } | { ok: false; reason: string };

/* ============================================================
 * 常量与工具
 * ============================================================ */

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

/** "YYYY-MM-DD" 偏移 n 天(纯字符串日历运算,无时区语义) */
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** 补记窗口(3.8.8):过去 7 天含今日可编辑,超窗/未来只读 */
function inWindow(date: string, today: string): boolean {
  return date >= addDaysStr(today, -7) && date <= today;
}

/* ============================================================
 * 读:饮食日视图(页面数据源,3.8.2/3.8.6)
 * ============================================================ */

export interface DietItemView {
  id: string;
  foodName: string;
  grams: number;
  /** per100 快照(编辑改重量时重算预览) */
  kcalPer100: number;
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealView {
  mealType: MealType;
  label: string;
  items: DietItemView[];
  /** 该餐小计(先求和再取整) */
  kcal: number;
}

export interface DietDayView {
  date: string;
  dayLabel: string;
  weekday: string;
  /** 补记窗口内(含今日)可编辑;超窗只读 */
  editable: boolean;
  meals: MealView[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  goals: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
}

/** 单条营养:per100 × grams / 100,取整 */
function itemKcal(row: { kcalPer100: number; grams: number }): number {
  return Math.round((row.kcalPer100 * row.grams) / 100);
}

function macro(per100: string, grams: number): number {
  return Math.round((Number(per100) * grams) / 100);
}

export async function getDietDayView(
  userId: string,
  date: string,
  today?: string,
): Promise<DietDayView> {
  const t = today ?? serverToday();
  const [rows, goals] = await Promise.all([
    db
      .select()
      .from(dietItems)
      .where(and(eq(dietItems.userId, userId), eq(dietItems.date, date)))
      .orderBy(asc(dietItems.createdAt), asc(dietItems.id)),
    getNutritionGoals(userId),
  ]);

  const totals = rows.reduce(
    (acc, r) => {
      const grams = Number(r.grams);
      acc.kcal += (r.kcalPer100 * grams) / 100;
      acc.protein += (Number(r.proteinPer100) * grams) / 100;
      acc.carbs += (Number(r.carbsPer100) * grams) / 100;
      acc.fat += (Number(r.fatPer100) * grams) / 100;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const [, m, d] = date.split("-");
  return {
    date,
    dayLabel: `${Number(m)}月${Number(d)}日`,
    weekday: weekdayCN(date),
    editable: inWindow(date, t),
    meals: MEAL_TYPES.map((mealType) => {
      const items = rows
        .filter((r) => r.mealType === mealType)
        .map((r) => ({
          id: r.id,
          foodName: r.foodName,
          grams: Number(r.grams),
          kcalPer100: r.kcalPer100,
          proteinPer100: r.proteinPer100,
          carbsPer100: r.carbsPer100,
          fatPer100: r.fatPer100,
          kcal: itemKcal({ kcalPer100: r.kcalPer100, grams: Number(r.grams) }),
          protein: macro(r.proteinPer100, Number(r.grams)),
          carbs: macro(r.carbsPer100, Number(r.grams)),
          fat: macro(r.fatPer100, Number(r.grams)),
        }));
      return {
        mealType,
        label: MEAL_LABELS[mealType],
        items,
        kcal: Math.round(items.reduce((n, it) => n + it.kcal, 0)),
      };
    }),
    totals: {
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    },
    goals: {
      kcal: goals?.caloriesKcal ?? null,
      protein: goals?.proteinG ?? null,
      carbs: goals?.carbsG ?? null,
      fat: goals?.fatG ?? null,
    },
  };
}

/* ============================================================
 * 读:食物库搜索(3.8.3:名称包含,我的在前,每页 20)
 * ============================================================ */

export interface FoodView {
  id: string;
  name: string;
  kcalPer100: number;
  /** numeric 字符串,如 "20.0" */
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
  isLiquid: boolean;
  owner: "mine" | "official";
}

export async function searchFoods(userId: string, q?: string): Promise<FoodView[]> {
  const rows = await db
    .select()
    .from(foods)
    .where(
      and(
        isNull(foods.deletedAt),
        or(isNull(foods.ownerId), eq(foods.ownerId, userId)),
        q ? ilike(foods.name, `%${q}%`) : undefined,
      ),
    )
    // 我的(owner 非空)在前,组内名称序
    .orderBy(sql`${foods.ownerId} is null asc`, foods.name)
    .limit(20);
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    kcalPer100: f.kcalPer100,
    proteinPer100: f.proteinPer100,
    carbsPer100: f.carbsPer100,
    fatPer100: f.fatPer100,
    isLiquid: f.isLiquid,
    owner: f.ownerId ? ("mine" as const) : ("official" as const),
  }));
}

/* ============================================================
 * 写:自定义食物(NUTRITION-002,3.8.4)
 * ============================================================ */

export interface FoodInput {
  name: string;
  kcalPer100: number;
  /** 每 100g 宏量(0~100,1 位小数;存 numeric(10,1)) */
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  isLiquid?: boolean;
}

/** 官方→403;他人→404(不泄露存在性);本人→放行(与动作库 classifyExercise 同语义) */
async function classifyFood(
  userId: string,
  foodId: string,
): Promise<{ ok: false; reason: "NOT_FOUND" | "OFFICIAL_FOOD" } | { ok: true; food: Food }> {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
  if (!food || food.deletedAt) return { ok: false, reason: "NOT_FOUND" };
  if (food.ownerId === null) return { ok: false, reason: "OFFICIAL_FOOD" };
  if (food.ownerId !== userId) return { ok: false, reason: "NOT_FOUND" };
  return { ok: true, food };
}

export async function createFood(userId: string, body: FoodInput): Promise<{ id: string }> {
  const [food] = await db
    .insert(foods)
    .values({
      ownerId: userId,
      name: body.name,
      kcalPer100: body.kcalPer100,
      proteinPer100: String(body.proteinPer100),
      carbsPer100: String(body.carbsPer100),
      fatPer100: String(body.fatPer100),
      isLiquid: body.isLiquid ?? false,
    })
    .returning({ id: foods.id });
  return food;
}

export async function updateFood(
  userId: string,
  foodId: string,
  body: Partial<FoodInput>,
): Promise<DietMutationResult<null>> {
  const cls = await classifyFood(userId, foodId);
  if (!cls.ok) return { ok: false, reason: cls.reason };
  await db
    .update(foods)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.kcalPer100 !== undefined ? { kcalPer100: body.kcalPer100 } : {}),
      ...(body.proteinPer100 !== undefined ? { proteinPer100: String(body.proteinPer100) } : {}),
      ...(body.carbsPer100 !== undefined ? { carbsPer100: String(body.carbsPer100) } : {}),
      ...(body.fatPer100 !== undefined ? { fatPer100: String(body.fatPer100) } : {}),
      ...(body.isLiquid !== undefined ? { isLiquid: body.isLiquid } : {}),
    })
    .where(eq(foods.id, foodId));
  return { ok: true, data: null };
}

/** 软删;历史记录走条目快照,不受影响(3.8.4) */
export async function deleteFood(
  userId: string,
  foodId: string,
): Promise<DietMutationResult<null>> {
  const cls = await classifyFood(userId, foodId);
  if (!cls.ok) return { ok: false, reason: cls.reason };
  await db.update(foods).set({ deletedAt: new Date() }).where(eq(foods.id, foodId));
  return { ok: true, data: null };
}

/* ============================================================
 * 写:饮食条目(NUTRITION-001/003)
 * ============================================================ */

/** 添加食物条目:校验窗口与食物可见性,写入快照(3.8.3/3.8.8) */
export async function addDietItem(input: {
  userId: string;
  date: string;
  mealType: MealType;
  foodId: string;
  grams: number;
  today?: string;
}): Promise<DietMutationResult<DietItem>> {
  const t = input.today ?? serverToday();
  if (!inWindow(input.date, t)) return { ok: false, reason: "DATE_OUT_OF_WINDOW" };

  const [food] = await db
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, input.foodId),
        isNull(foods.deletedAt),
        or(isNull(foods.ownerId), eq(foods.ownerId, input.userId)),
      ),
    )
    .limit(1);
  if (!food) return { ok: false, reason: "NOT_FOUND" };

  const [item] = await db
    .insert(dietItems)
    .values({
      userId: input.userId,
      date: input.date,
      mealType: input.mealType,
      foodId: food.id,
      foodName: food.name,
      kcalPer100: food.kcalPer100,
      proteinPer100: food.proteinPer100,
      carbsPer100: food.carbsPer100,
      fatPer100: food.fatPer100,
      grams: String(input.grams),
    })
    .returning();
  await trackRecord(input.userId, "diet_item", {
    date: input.date,
    meal_type: input.mealType,
    food_id: food.id,
  });
  return { ok: true, data: item };
}

/** 改重量(3.8.5:自动重算=读取时按快照计算,仅更新 grams);超窗只读 */
export async function updateDietItem(input: {
  userId: string;
  itemId: string;
  grams: number;
  today?: string;
}): Promise<DietMutationResult<null>> {
  const [item] = await db
    .select()
    .from(dietItems)
    .where(and(eq(dietItems.id, input.itemId), eq(dietItems.userId, input.userId)))
    .limit(1);
  if (!item) return { ok: false, reason: "NOT_FOUND" };
  const t = input.today ?? serverToday();
  if (!inWindow(item.date, t)) return { ok: false, reason: "DATE_OUT_OF_WINDOW" };

  await db.update(dietItems).set({ grams: String(input.grams) }).where(eq(dietItems.id, item.id));
  return { ok: true, data: null };
}

/** 删除条目(记录类物理删);删除后统计重算(3.8.5) */
export async function deleteDietItem(input: {
  userId: string;
  itemId: string;
  today?: string;
}): Promise<DietMutationResult<null>> {
  const [item] = await db
    .select()
    .from(dietItems)
    .where(and(eq(dietItems.id, input.itemId), eq(dietItems.userId, input.userId)))
    .limit(1);
  if (!item) return { ok: false, reason: "NOT_FOUND" };
  const t = input.today ?? serverToday();
  if (!inWindow(item.date, t)) return { ok: false, reason: "DATE_OUT_OF_WINDOW" };

  await db.delete(dietItems).where(eq(dietItems.id, item.id));
  return { ok: true, data: null };
}
