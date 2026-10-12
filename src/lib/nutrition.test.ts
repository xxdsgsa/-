/**
 * 营养目标计算测试(PRD 3.4 验收标准)
 *
 * 覆盖:
 * - BMR 公式(Mifflin-St Jeor)
 * - 活动系数分段
 * - 减脂/重塑下限保护(不低于 BMR)
 * - 增肌 +300,保持不调整
 * - 蛋白按目标 g/kg
 * - 饮水 35ml/kg 向上取整 100
 * - 热量 / 营养素取整
 */
import { describe, it, expect } from "vitest";

import {
  activityFactor,
  adjustCalories,
  calcBMR,
  calcNutritionGoals,
  calcTDEE,
  DEFAULT_HEIGHT_CM,
} from "@/lib/nutrition";

describe("calcBMR (Mifflin-St Jeor)", () => {
  it("男性:10w + 6.25h - 5a + 5", () => {
    // 70kg, 175cm, 25y:10*70 + 6.25*175 - 5*25 + 5 = 700+1093.75-125+5=1673.75
    expect(calcBMR({ gender: "male", age: 25, heightCm: 175, weightKg: 70 })).toBeCloseTo(1673.75, 2);
  });
  it("女性:10w + 6.25h - 5a - 161", () => {
    // 55kg, 165cm, 30y:550+1031.25-150-161=1270.25
    expect(calcBMR({ gender: "female", age: 30, heightCm: 165, weightKg: 55 })).toBeCloseTo(1270.25, 2);
  });
  it("身高缺省按性别中位估算", () => {
    const male = calcBMR({ gender: "male", age: 25, weightKg: 70 });
    const female = calcBMR({ gender: "female", age: 25, weightKg: 70 });
    // 男 170 / 女 160,身高差 10cm;同重同年龄:男 - 女 = 6.25*10 + 5 + 161 = 228.5
    expect(male - female).toBeCloseTo(228.5, 1);
    // 男始终 > 女(因 +5 vs -161)
    expect(male).toBeGreaterThan(female);
  });
  it("男性默认值 = 170cm", () => {
    expect(DEFAULT_HEIGHT_CM.male).toBe(170);
  });
});

describe("activityFactor (3.4 步 2)", () => {
  it("0~1 次 → 1.2 久坐", () => {
    expect(activityFactor(0)).toBe(1.2);
    expect(activityFactor(1)).toBe(1.2);
  });
  it("2~3 次 → 1.375 轻度", () => {
    expect(activityFactor(2)).toBe(1.375);
    expect(activityFactor(3)).toBe(1.375);
  });
  it("4~5 次 → 1.55 中度", () => {
    expect(activityFactor(4)).toBe(1.55);
    expect(activityFactor(5)).toBe(1.55);
  });
  it("6~7 次 → 1.725 高度", () => {
    expect(activityFactor(6)).toBe(1.725);
    expect(activityFactor(7)).toBe(1.725);
  });
});

describe("adjustCalories (3.4 步 3)", () => {
  const bmr = 1500;
  it("增肌 +300", () => {
    expect(adjustCalories(2000, bmr, "muscle_gain")).toBe(2300);
  });
  it("减脂 -400 但不低于 BMR", () => {
    expect(adjustCalories(2000, bmr, "fat_loss")).toBe(1600);
    // 极端:tdee=1500,bmr=1500 → 不应低于 bmr
    expect(adjustCalories(1500, bmr, "fat_loss")).toBe(bmr);
  });
  it("重塑 -200 但不低于 BMR", () => {
    expect(adjustCalories(2000, bmr, "recomp")).toBe(1800);
    expect(adjustCalories(1500, bmr, "recomp")).toBe(bmr);
  });
  it("保持 不调整", () => {
    expect(adjustCalories(2000, bmr, "health")).toBe(2000);
  });
});

describe("calcTDEE", () => {
  it("BMR × 活动系数", () => {
    expect(calcTDEE(1500, 0)).toBe(1800); // 1500*1.2
    expect(calcTDEE(1500, 4)).toBe(2325); // 1500*1.55
  });
});

describe("calcNutritionGoals (3.4.4 验收 5 项)", () => {
  it("新用户:男性增肌,30 岁,175cm,70kg,每周 4 次 → 五项全部产出", () => {
    const g = calcNutritionGoals({
      gender: "male",
      age: 30,
      heightCm: 175,
      weightKg: 70,
      goalType: "muscle_gain",
      weeklyTrainingDays: 4,
    });
    // BMR ≈ 1649.25,TDEE ≈ 2556.4,增肌 → 2856.4 → 取整到 2860
    expect(g.calories).toBe(2860);
    // 蛋白 1.6 * 70 = 112
    expect(g.protein).toBe(112);
    // 脂肪 2860*0.25/9 = 79.4 → 79
    expect(g.fat).toBe(79);
    // 碳水 (2860 - 112*4 - 79*9) / 4 = (2860-448-711)/4 = 1701/4 = 425.25 → 425
    expect(g.carbs).toBe(425);
    // 饮水 70*35=2450 → 向上 100 → 2500
    expect(g.waterMl).toBe(2500);
  });

  it("女性减脂,25 岁,165cm,55kg,每周 2 次", () => {
    const g = calcNutritionGoals({
      gender: "female",
      age: 25,
      heightCm: 165,
      weightKg: 55,
      goalType: "fat_loss",
      weeklyTrainingDays: 2,
    });
    // BMR = 550 + 1031.25 - 125 - 161 = 1295.25
    // TDEE = 1295.25 * 1.375 = 1780.97
    // 减脂 = 1780.97 - 400 = 1380.97 → 取整 1380
    expect(g.calories).toBe(1380);
    // 蛋白 2.0 * 55 = 110
    expect(g.protein).toBe(110);
    // 脂肪 1380*0.25/9 = 38.3 → 38
    expect(g.fat).toBe(38);
    // 饮水 55*35=1925 → 2000
    expect(g.waterMl).toBe(2000);
  });

  it("热量取整到 10 kcal(3.4.3)", () => {
    const g = calcNutritionGoals({
      gender: "male",
      age: 30,
      heightCm: 175,
      weightKg: 70,
      goalType: "muscle_gain",
      weeklyTrainingDays: 4,
    });
    expect(g.calories % 10).toBe(0);
  });

  it("营养素取整到 1g", () => {
    const g = calcNutritionGoals({
      gender: "male",
      age: 30,
      heightCm: 175,
      weightKg: 70,
      goalType: "health",
      weeklyTrainingDays: 3,
    });
    expect(Number.isInteger(g.protein)).toBe(true);
    expect(Number.isInteger(g.fat)).toBe(true);
    expect(Number.isInteger(g.carbs)).toBe(true);
  });

  it("饮水向上取整到 100ml(3.4.2 步 5)", () => {
    // 51kg * 35 = 1785 → 1800
    const g = calcNutritionGoals({
      gender: "male",
      age: 30,
      weightKg: 51,
      goalType: "health",
      weeklyTrainingDays: 0,
    });
    expect(g.waterMl).toBe(1800);
    // 60kg * 35 = 2100
    const g2 = calcNutritionGoals({
      gender: "male",
      age: 30,
      weightKg: 60,
      goalType: "health",
      weeklyTrainingDays: 0,
    });
    expect(g2.waterMl).toBe(2100);
  });
});
