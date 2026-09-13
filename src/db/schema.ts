/**
 * FitMate 数据模型 —— 依据 docs/TECH.md(第二部分,17 张表)
 *
 * 全局约定(TECH 2.3):
 * - 类型:热量/次数 int;重量/克数/剂量 numeric(10,1);时间 timestamptz(UTC);日期 date(设备时区日历日,ADR-12)
 * - 软删除:用户主数据用 deleted_at;记录类不物理改
 * - 外键在"多"的一方,且手动加索引(PG 不自动为 FK 建索引)
 * - 体重权威源:body_weight_records 最新一条,users 不存当前体重
 * - 认证:Better Auth 自管理 account/session 等表(接入认证模块时生成),
 *   users 表已按 Better Auth 兼容形式定义(id/email/email_verified/name)
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const numeric101 = (name: string) => numeric(name, { precision: 10, scale: 1 });

/* ============================================================
 * 用户与账号(1~3)
 * ============================================================ */

/** 用户(Better Auth 兼容;密码由 Better Auth 的 account 表管理,不落本表) */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull(), // Better Auth 必需字段
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  /** male / female */
  gender: text("gender"),
  age: integer("age"),
  heightCm: integer("height_cm"),
  bodyFatPct: numeric101("body_fat_pct"),
  /** fat_loss / muscle_gain / recomp / health */
  goalType: text("goal_type"),
  targetWeightKg: numeric101("target_weight_kg"),
  targetDate: date("target_date"),
  weeklyTrainingDays: integer("weekly_training_days"),
  /** 首次设置完成时间;非空 = 已通过 onboarding */
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  /** 非空即处于注销 15 天冷静期(AUTH-004) */
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("users_email_uidx").on(t.email),
]);

/** 营养目标(1:1;手动项不被自动重算覆盖,3.4.3) */
export const nutritionGoals = pgTable("nutrition_goals", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  caloriesKcal: integer("calories_kcal"),
  proteinG: integer("protein_g"),
  carbsG: integer("carbs_g"),
  fatG: integer("fat_g"),
  waterMl: integer("water_ml"),
  manualCalories: boolean("manual_calories").notNull().default(false),
  manualProtein: boolean("manual_protein").notNull().default(false),
  manualCarbs: boolean("manual_carbs").notNull().default(false),
  manualFat: boolean("manual_fat").notNull().default(false),
  manualWater: boolean("manual_water").notNull().default(false),
  /** "体重变化 2kg 触发重算"的比较基线(每次计算时写入) */
  weightAtCalc: numeric101("weight_at_calc"),
  recalculatedAt: timestamp("recalculated_at", { withTimezone: true }),
});

/** 邮箱验证码(兜底记录;实际发送与校验由 Better Auth emailOTP 管理,3.6.2/3.6.3 限频) */
export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  /** register / reset / delete */
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // (email, created_at) 计数限频:60s 冷却、日 5 次
  index("verification_codes_email_created_idx").on(t.email, t.createdAt),
]);

/* ============================================================
 * 训练(4~9)
 * ============================================================ */

/** 训练周期(每用户仅一个"进行中"——部分唯一索引) */
export const trainingCycles = pgTable("training_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  /** 未开始 / 进行中 / 已结束 */
  status: text("status").notNull().default("未开始"),
  createdAt: timestamps.createdAt,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("training_cycles_user_idx").on(t.userId),
  uniqueIndex("training_cycles_one_active_per_user")
    .on(t.userId)
    .where(sql`status = '进行中'`),
]);

/** 周期内的天(含休息日) */
export const trainingDays = pgTable("training_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").notNull().references(() => trainingCycles.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  isRest: boolean("is_rest").notNull().default(false),
}, (t) => [
  uniqueIndex("training_days_cycle_date_uidx").on(t.cycleId, t.date),
]);

/** 计划训练(一天多训练 = 多行,v1.5 追加制) */
export const trainings = pgTable("trainings", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingDayId: uuid("training_day_id").notNull().references(() => trainingDays.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  index("trainings_day_idx").on(t.trainingDayId),
]);

/** 动作库(owner_id IS NULL = 官方 80 条种子;同一动作可重复添加到同一训练,3.2.9) */
export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** 力量 / 有氧 / 自重 / 拉伸 */
  category: text("category").notNull(),
  muscleGroup: text("muscle_group").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("exercises_owner_name_idx").on(t.ownerId, t.name),
]);

/** 训划动作项(计划参数) */
export const trainingItems = pgTable("training_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingId: uuid("training_id").notNull().references(() => trainings.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  targetWeight: numeric101("target_weight"),
  restSeconds: integer("rest_seconds").notNull().default(90),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  index("training_items_training_idx").on(t.trainingId),
  index("training_items_exercise_idx").on(t.exerciseId),
]);

/** 训练会话(计划↔执行;每用户仅一个"进行中"——中断恢复依据 3.1.10) */
export const trainingSessions = pgTable("training_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  trainingId: uuid("training_id").notNull().references(() => trainings.id),
  date: date("date").notNull(),
  /** 进行中 / 已完成 */
  status: text("status").notNull().default("进行中"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
}, (t) => [
  index("training_sessions_user_idx").on(t.userId),
  index("training_sessions_training_idx").on(t.trainingId),
  index("training_sessions_user_date_idx").on(t.userId, t.date),
  uniqueIndex("training_sessions_one_in_progress")
    .on(t.userId)
    .where(sql`status = '进行中'`),
]);

/** 逐组记录(总结页与历史的唯一数据源) */
export const setLogs = pgTable("set_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => trainingSessions.id, { onDelete: "cascade" }),
  trainingItemId: uuid("training_item_id").notNull().references(() => trainingItems.id),
  setIndex: integer("set_index").notNull(),
  actualWeight: numeric101("actual_weight"),
  actualReps: integer("actual_reps"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("set_logs_session_idx").on(t.sessionId),
  index("set_logs_item_idx").on(t.trainingItemId),
]);

/** 手动标记(未完成;同日撤销 = 删行,3.1.9) */
export const dayMarks = pgTable("day_marks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  /** missed = 未完成标记 */
  kind: text("kind").notNull().default("missed"),
}, (t) => [
  uniqueIndex("day_marks_user_date_uidx").on(t.userId, t.date),
]);

/* ============================================================
 * 饮食 / 补剂 / 饮水 / 体重(10~15)
 * ============================================================ */

/** 食物库(owner_id IS NULL = 官方;per100 单位,用户食物仅本人可见) */
export const foods = pgTable("foods", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kcalPer100: integer("kcal_per100").notNull(),
  proteinPer100: numeric101("protein_per100").notNull(),
  carbsPer100: numeric101("carbs_per100").notNull(),
  fatPer100: numeric101("fat_per100").notNull(),
  isLiquid: boolean("is_liquid").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("foods_owner_name_idx").on(t.ownerId, t.name),
]);

/** 饮食条目(引用+快照:删除食物不影响历史,3.8.4;补记窗口由 date 天然支持) */
export const dietItems = pgTable("diet_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  /** breakfast / lunch / dinner / snack */
  mealType: text("meal_type").notNull(),
  foodId: uuid("food_id").references(() => foods.id),
  // 快照(写入时冗余,读历史不依赖 foods 表)
  foodName: text("food_name").notNull(),
  kcalPer100: integer("kcal_per100").notNull(),
  proteinPer100: numeric101("protein_per100").notNull(),
  carbsPer100: numeric101("carbs_per100").notNull(),
  fatPer100: numeric101("fat_per100").notNull(),
  grams: numeric101("grams").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("diet_items_user_date_idx").on(t.userId, t.date),
]);

/** 补剂(用户自建) */
export const supplements = pgTable("supplements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** scoop / g / pill / tablet / ml */
  unit: text("unit").notNull(),
  dose: numeric101("dose").notNull(),
  dailyTarget: numeric101("daily_target"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("supplements_user_idx").on(t.userId),
]);

/** 补剂打卡(引用+快照;一天多次,带时间戳) */
export const supplementLogs = pgTable("supplement_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  supplementId: uuid("supplement_id").references(() => supplements.id),
  // 快照
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  dose: numeric101("dose").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  date: date("date").notNull(),
}, (t) => [
  index("supplement_logs_user_date_idx").on(t.userId, t.date),
]);

/** 饮水记录(左滑删单条,3.10) */
export const waterLogs = pgTable("water_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  amountMl: integer("amount_ml").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("water_logs_user_date_idx").on(t.userId, t.date),
]);

/** 体重记录(唯一 (user_id, date):同日覆盖走 upsert,3.2.6) */
export const bodyWeightRecords = pgTable("body_weight_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  weightKg: numeric101("weight_kg").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("body_weight_user_date_uidx").on(t.userId, t.date),
]);

/* ============================================================
 * 统计辅助(16)
 * ============================================================ */

/** 服务端埋点(P2-24 口径见 TECH 附录 B;V1 不引入第三方分析) */
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  props: jsonb("props"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("events_name_created_idx").on(t.name, t.createdAt),
]);

/* ============================================================
 * 派生类型
 * ============================================================ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type TrainingCycle = typeof trainingCycles.$inferSelect;
export type TrainingDay = typeof trainingDays.$inferSelect;
export type Training = typeof trainings.$inferSelect;
export type TrainingItem = typeof trainingItems.$inferSelect;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type DietItem = typeof dietItems.$inferSelect;
export type Supplement = typeof supplements.$inferSelect;
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type WaterLog = typeof waterLogs.$inferSelect;
export type BodyWeightRecord = typeof bodyWeightRecords.$inferSelect;
