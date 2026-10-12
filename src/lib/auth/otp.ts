/**
 * 自实现账号注销 OTP(PRD 3.6.8):不复用 Better Auth emailOTP 插件——
 * 其 type 联合类型只支持 sign-in / email-verification / forget-password / change-email,
 * 注销是独立场景,自实现更清晰。
 *
 * 流程:
 *   1. createDeletionOtp(userId) → 生成 6 位码,sha256 入 verifications 表
 *   2. 调用方发送邮件(开发期 console.log,生产 Resend 在 sendVerificationOTP 钩子已留口)
 *   3. consumeDeletionOtp(userId, otp) → 校验 + 原子删除,失败返 false
 *
 * 限频:由 API 路由层(防恶意刷码);前端 60s 冷却 + 每日 5 次(3.6.3)在 API 返回值告知。
 */
import { createHash, randomInt } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { verifications } from "@/db/schema";

/** OTP 5 分钟过期(与 Better Auth emailOTP 默认一致) */
const OTP_TTL_SECONDS = 300;

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

/** 生成 6 位数字 OTP(0 不带头) */
export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

const IDENT_PREFIX = "account-deletion:";

function identifier(userId: string): string {
  return `${IDENT_PREFIX}${userId}`;
}

/** 距上次创建 OTP 的毫秒数(用于前端 60s 倒计时);无记录返回 null */
export async function lastOtpAgeMs(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ createdAt: verifications.createdAt })
    .from(verifications)
    .where(and(eq(verifications.identifier, identifier(userId))))
    .limit(1);
  if (!row) return null;
  return Date.now() - row.createdAt.getTime();
}

/**
 * 为指定用户创建/覆盖 6 位 OTP(rotate 策略,3.6.3 评审:发新码即旧码作废)
 * 返回明文 OTP(调用方负责发送)
 */
export async function createDeletionOtp(userId: string): Promise<string> {
  const otp = generateOtp();
  const value = hashOtp(otp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);

  await db
    .delete(verifications)
    .where(and(eq(verifications.identifier, identifier(userId))));
  await db.insert(verifications).values({
    id: crypto.randomUUID(),
    identifier: identifier(userId),
    value,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });
  return otp;
}

/** 校验并消费 OTP;成功返回 true(原子删除) */
export async function consumeDeletionOtp(userId: string, otp: string): Promise<boolean> {
  if (!/^\d{6}$/.test(otp)) return false;
  const [row] = await db
    .select()
    .from(verifications)
    .where(and(eq(verifications.identifier, identifier(userId))))
    .limit(1);
  if (!row) return false;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(verifications).where(eq(verifications.id, row.id));
    return false;
  }
  if (row.value !== hashOtp(otp)) return false;
  await db.delete(verifications).where(eq(verifications.id, row.id));
  return true;
}
