/**
 * 账号服务层(PRD 3.6.7~3.6.8):
 *
 * - getUserProfile:用户资料(昵称/身体数据/目标/营养目标)聚合只读视图
 * - requestDeletion:申请注销(写 deletionRequestedAt = now())
 * - cancelDeletion:冷静期内取消注销(清空 deletionRequestedAt)
 * - getDeletionStatus:读取注销状态与冷静期剩余天数
 * - purgeExpiredUsers:扫描冷静期满用户并物理删除(3.6.8)
 * - findUser:按 id 查基础信息(注销流程用)
 *
 * 物理删除触发点:(tabs)/layout.tsx 每次登录会话拉取时调用,无外部 cron 依赖。
 * 所有用户表 ON DELETE CASCADE(见 schema.ts),用户行删除即级联清理。
 */
import { and, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { nutritionGoals, users } from "@/db/schema";
import { getNutritionGoals } from "./onboarding";

/** PRD 3.6.8 冷静期:15 天 */
export const DELETION_COOLING_DAYS = 15;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  nickname: string | null;
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  bodyFatPct: number | null;
  goalType: string | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  weeklyTrainingDays: number | null;
  onboardedAt: Date | null;
  deletionRequestedAt: Date | null;
  nutrition: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    water: number | null;
    manual: { calories: boolean; protein: boolean; carbs: boolean; fat: boolean; water: boolean };
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const goals = await getNutritionGoals(userId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    age: user.age,
    heightCm: user.heightCm,
    bodyFatPct: user.bodyFatPct ? Number(user.bodyFatPct) : null,
    goalType: user.goalType,
    targetWeightKg: user.targetWeightKg ? Number(user.targetWeightKg) : null,
    targetDate: user.targetDate,
    weeklyTrainingDays: user.weeklyTrainingDays,
    onboardedAt: user.onboardedAt,
    deletionRequestedAt: user.deletionRequestedAt,
    nutrition: {
      calories: goals?.caloriesKcal ?? null,
      protein: goals?.proteinG ?? null,
      carbs: goals?.carbsG ?? null,
      fat: goals?.fatG ?? null,
      water: goals?.waterMl ?? null,
      manual: {
        calories: goals?.manualCalories ?? false,
        protein: goals?.manualProtein ?? false,
        carbs: goals?.manualCarbs ?? false,
        fat: goals?.manualFat ?? false,
        water: goals?.manualWater ?? false,
      },
    },
  };
}

export interface DeletionStatus {
  inCooling: boolean;
  requestedAt: Date | null;
  /** 冷静期剩余天数(向上取整,负数=已超期可物理删除) */
  remainingDays: number | null;
}

export async function getDeletionStatus(userId: string): Promise<DeletionStatus> {
  const [row] = await db
    .select({ deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row?.deletionRequestedAt) {
    return { inCooling: false, requestedAt: null, remainingDays: null };
  }
  const ms = Date.now() - row.deletionRequestedAt.getTime();
  const elapsedDays = ms / (24 * 60 * 60 * 1000);
  const remaining = Math.ceil(DELETION_COOLING_DAYS - elapsedDays);
  return {
    inCooling: true,
    requestedAt: row.deletionRequestedAt,
    remainingDays: remaining,
  };
}

/** 申请注销:写 deletionRequestedAt = now;已是冷静期则幂等返回 true */
export async function requestDeletion(userId: string): Promise<DeletionStatus> {
  const [row] = await db
    .select({ id: users.id, deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return { inCooling: false, requestedAt: null, remainingDays: null };

  if (!row.deletionRequestedAt) {
    await db
      .update(users)
      .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  return getDeletionStatus(userId);
}

/** 取消注销(冷静期内) */
export async function cancelDeletion(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId)))
    .limit(1);
  if (!row) return false;
  await db
    .update(users)
    .set({ deletionRequestedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return true;
}

/** 调整饮水目标(3.6.7 设置入口):设置 manualWater=true 标记已手动 */
export async function setWaterGoal(
  userId: string,
  waterMl: number,
): Promise<{ ok: boolean; waterMl: number | null; manual: boolean }> {
  if (!Number.isInteger(waterMl) || waterMl < 500 || waterMl > 6000) {
    return { ok: false, waterMl: null, manual: false };
  }
  await db
    .insert(nutritionGoals)
    .values({
      userId,
      waterMl,
      manualWater: true,
    })
    .onConflictDoUpdate({
      target: nutritionGoals.userId,
      set: { waterMl, manualWater: true },
    });
  return { ok: true, waterMl, manual: true };
}

/** 清除手动标记,恢复按 3.4 自动计算(3.6.7 评审:已手动调整的项系统不自动覆盖) */
export async function clearWaterGoalManual(
  userId: string,
): Promise<{ ok: boolean }> {
  const [row] = await db
    .select({ userId: nutritionGoals.userId })
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, userId))
    .limit(1);
  if (!row) return { ok: false };
  await db
    .update(nutritionGoals)
    .set({ manualWater: false })
    .where(eq(nutritionGoals.userId, userId));
  return { ok: true };
}

/** 找用户基础字段(注销流程核查用) */
export async function findUser(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      deletionRequestedAt: users.deletionRequestedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/**
 * 物理删除冷静期满用户(3.6.8):返回被删除的 userId 列表
 *
 * 触发策略:
 * - 调用前:确认未在事务里(本身是单次 SQL 查询 + 多行 DELETE,CASCADE 自行处理)
 * - 调用频:(tabs)/layout.tsx 每次页面请求都调,15 天阈值查询命中时即时清理
 * - 影响范围:仅删超过 15 天的 deletionRequestedAt,正常用户不被触及
 */
export async function purgeExpiredUsers(now = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - DELETION_COOLING_DAYS * 24 * 60 * 60 * 1000);
  // 先查要删的 ids(用于返回 + 日志)
  const expired = await db
    .select({ id: users.id })
    .from(users)
    .where(and(lte(users.deletionRequestedAt, cutoff)));
  if (expired.length === 0) return [];

  for (const row of expired) {
    // 关联表大多 ON DELETE CASCADE;users + sessions + accounts + verifications 都会自动级联
    await db.delete(users).where(eq(users.id, row.id));
  }
  return expired.map((r) => r.id);
}
