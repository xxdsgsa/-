/**
 * Onboarding 服务层(PRD 3.6.6:最后一步【完成设置】才落库)
 *
 * 原子性:users 身体数据 + nutrition_goals 首次目标 + 当日体重记录。
 * neon-http 驱动无 db.transaction API,改用 db.batch——多语句打包为
 * 单次 HTTP 请求,由 Neon 服务端在单个事务内执行(见 db/index.ts)。
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bodyWeightRecords, nutritionGoals, users } from "@/db/schema";
import { calcNutritionGoals, type Gender, type GoalType } from "@/lib/nutrition";

export interface CompleteOnboardingInput {
  userId: string;
  gender: Gender;
  age: number;
  heightCm?: number | null;
  weightKg: number;
  bodyFatPct?: number | null;
  goalType: GoalType;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  weeklyTrainingDays: number;
  /** 客户端"今日"(设备时区日历日,ADR-12) */
  today: string;
  /** 用户在第 3 步手动调整的项;未调整项由服务端权威计算 */
  manualGoals?: Partial<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    waterMl: number;
  }>;
}

export async function completeOnboarding(input: CompleteOnboardingInput) {
  const computed = calcNutritionGoals({
    gender: input.gender,
    age: input.age,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    goalType: input.goalType,
    weeklyTrainingDays: input.weeklyTrainingDays,
  });

  const manual = input.manualGoals ?? {};
  // 手动项用用户值,未调整项用计算值(3.4.3:已手动调整的项不被自动覆盖)
  const goals = {
    calories: manual.calories ?? computed.calories,
    protein: manual.protein ?? computed.protein,
    carbs: manual.carbs ?? computed.carbs,
    fat: manual.fat ?? computed.fat,
    waterMl: manual.waterMl ?? computed.waterMl,
  };
  // 目标行(键名 = schema 列名;勿直接展开 goals,键名不匹配会被静默丢弃)
  const goalsRow = {
    caloriesKcal: goals.calories,
    proteinG: goals.protein,
    carbsG: goals.carbs,
    fatG: goals.fat,
    waterMl: goals.waterMl,
  };

  await db.batch([
    db
      .update(users)
      .set({
        gender: input.gender,
        age: input.age,
        heightCm: input.heightCm ?? null,
        bodyFatPct: input.bodyFatPct != null ? String(input.bodyFatPct) : null,
        goalType: input.goalType,
        targetWeightKg: input.targetWeightKg != null ? String(input.targetWeightKg) : null,
        targetDate: input.targetDate ?? null,
        weeklyTrainingDays: input.weeklyTrainingDays,
        onboardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId)),

    db
      .insert(nutritionGoals)
      .values({
        userId: input.userId,
        ...goalsRow,
        manualCalories: manual.calories != null,
        manualProtein: manual.protein != null,
        manualCarbs: manual.carbs != null,
        manualFat: manual.fat != null,
        manualWater: manual.waterMl != null,
        weightAtCalc: String(input.weightKg), // 重算基线(TECH 2.2)
        recalculatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: nutritionGoals.userId,
        set: {
          ...goalsRow,
          manualCalories: manual.calories != null,
          manualProtein: manual.protein != null,
          manualCarbs: manual.carbs != null,
          manualFat: manual.fat != null,
          manualWater: manual.waterMl != null,
          weightAtCalc: String(input.weightKg),
          recalculatedAt: new Date(),
        },
      }),

    // 当日体重(唯一约束 upsert,TECH 2.2)
    db
      .insert(bodyWeightRecords)
      .values({
        userId: input.userId,
        date: input.today,
        weightKg: String(input.weightKg),
      })
      .onConflictDoUpdate({
        target: [bodyWeightRecords.userId, bodyWeightRecords.date],
        set: { weightKg: String(input.weightKg) },
      }),
  ]);

  return goals;
}

/** 查询用户是否已完成首次设置 */
export async function isOnboarded(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ onboardedAt: users.onboardedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.onboardedAt != null;
}

/** 读取当前营养目标(dashboard 饮食卡用) */
export async function getNutritionGoals(userId: string) {
  const [row] = await db
    .select()
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, userId))
    .limit(1);
  return row ?? null;
}
