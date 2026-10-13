/**
 * POST /api/account/deletion/request —— 申请注销验证码(PRD 3.6.8)
 *
 * 1. 60s 冷却(3.6.3 决策)
 * 2. 每日 5 次(简单计数:verifications 表当日创建数,3.6.3)
 * 3. 发码:开发期 console.log(与 Better Auth emailOTP 共用 Resend 待接入)
 *
 * 返回:明文 OTP 不在响应中,前端仅需知 cooldownSeconds / remainingToday。
 */
import { NextRequest, NextResponse } from "next/server";

import { requireUserId } from "@/lib/api/auth";
import { createDeletionOtp, lastOtpAgeMs } from "@/lib/auth/otp";
import { findUser } from "@/lib/db/queries/account";
import { db } from "@/db";
import { verifications } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const COOLING_MS = 60 * 1000;
const DAILY_MAX = 5;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const user = await findUser(userId);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "账号不存在" } },
      { status: 404 },
    );
  }

  // 60s 冷却
  const ageMs = await lastOtpAgeMs(userId);
  if (ageMs != null && ageMs < COOLING_MS) {
    const cooldown = Math.ceil((COOLING_MS - ageMs) / 1000);
    return NextResponse.json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: `请等待 ${cooldown}s 后重试`,
      },
      data: { cooldownSeconds: cooldown },
    }, { status: 429 });
  }

  // 每日 5 次计数
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [cnt] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(verifications)
    .where(
      and(
        eq(verifications.identifier, `account-deletion:${userId}`),
        gte(verifications.createdAt, todayStart),
      ),
    );
  const todayCount = cnt?.n ?? 0;
  if (todayCount >= DAILY_MAX) {
    return NextResponse.json({
      success: false,
      error: { code: "RATE_LIMITED", message: "今日发送次数已达上限,请明日再试" },
      data: { remainingToday: 0 },
    }, { status: 429 });
  }

  const otp = await createDeletionOtp(userId);
  // 开发期:console 输出(与 auth.ts sendVerificationOTP 同样策略,TODO(resend))
  // 接入 Resend 后替换为:await sendEmail({ to: user.email, subject: "注销申请", code: otp })
  console.log(`[auth][dev] deletion OTP -> ${user.email}: ${otp}`);

  return NextResponse.json({
    success: true,
    data: {
      cooldownSeconds: 60,
      remainingToday: DAILY_MAX - todayCount - 1,
    },
  });
}
