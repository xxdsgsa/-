/**
 * 营养目标计算(PRD 3.4,Mifflin-St Jeor)
 *
 * 纯函数,无 IO——附录 A 测试策略的优先覆盖对象(营养公式算错即事故)。
 * 取整规则:热量到 10 kcal,营养素到 1 g,饮水向上取整到 100 ml。
 */

export type Gender = "male" | "female";
/** 目标类型(schema users.goal_type 同款枚举) */
export type GoalType = "muscle_gain" | "fat_loss" | "recomp" | "health";

export interface NutritionInput {
  gender: Gender;
  age: number;
  /** 100~250;未填时按平均身高估算(男 170 / 女 160),UI 需注明 */
  heightCm?: number | null;
  weightKg: number;
  goalType: GoalType;
  weeklyTrainingDays: number;
}

export interface NutritionGoals {
  calories: number; // kcal
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  waterMl: number;
}

/** 中位身高(身高为可选字段,缺失时的估算基准) */
export const DEFAULT_HEIGHT_CM: Record<Gender, number> = {
  male: 170,
  female: 160,
};

/** 第 1 步:基础代谢 BMR(Mifflin-St Jeor) */
export function calcBMR(input: Pick<NutritionInput, "gender" | "age" | "heightCm" | "weightKg">): number {
  const height = input.heightCm ?? DEFAULT_HEIGHT_CM[input.gender];
  const base = 10 * input.weightKg + 6.25 * height - 5 * input.age;
  return input.gender === "male" ? base + 5 : base - 161;
}

/** 第 2 步:活动系数(每周训练次数 → 系数) */
export function activityFactor(weeklyTrainingDays: number): number {
  if (weeklyTrainingDays <= 1) return 1.2; // 久坐
  if (weeklyTrainingDays <= 3) return 1.375; // 轻度
  if (weeklyTrainingDays <= 5) return 1.55; // 中度
  return 1.725; // 高度(6~7)
}

/** 每日总消耗 TDEE */
export function calcTDEE(bmr: number, weeklyTrainingDays: number): number {
  return bmr * activityFactor(weeklyTrainingDays);
}

/** 第 3 步:按目标调整热量(减脂/重塑下限保护 BMR) */
export function adjustCalories(tdee: number, bmr: number, goalType: GoalType): number {
  switch (goalType) {
    case "muscle_gain":
      return tdee + 300;
    case "fat_loss":
      return Math.max(tdee - 400, bmr);
    case "recomp":
      return Math.max(tdee - 200, bmr);
    case "health":
      return tdee;
  }
}

/** 第 4+5 步:宏量分配 + 饮水目标,输出最终五项 */
export function calcNutritionGoals(input: NutritionInput): NutritionGoals {
  const bmr = calcBMR(input);
  const tdee = calcTDEE(bmr, input.weeklyTrainingDays);
  const calories = Math.round(adjustCalories(tdee, bmr, input.goalType) / 10) * 10;

  // 蛋白:增肌/保持 1.6g/kg;减脂/重塑 2.0g/kg
  const proteinPerKg = input.goalType === "muscle_gain" || input.goalType === "health" ? 1.6 : 2.0;
  const protein = Math.round(proteinPerKg * input.weightKg);

  // 脂肪:总热量 25% ÷ 9
  const fat = Math.round((calories * 0.25) / 9);

  // 碳水:剩余热量 ÷ 4(下限 0 防御极端输入)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  // 饮水:体重 × 35ml,向上取整到 100ml
  const waterMl = Math.ceil((input.weightKg * 35) / 100) * 100;

  return { calories, protein, carbs, fat, waterMl };
}

/** 服务端目标类型/性别中文名(UI 展示) */
export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  muscle_gain: "增肌",
  fat_loss: "减脂",
  recomp: "重塑",
  health: "保持",
};
