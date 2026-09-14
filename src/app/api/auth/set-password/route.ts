/**
 * 注册流程第二步:为 OTP 建立的账号设置密码
 *
 * 注册流程(PRD 3.6.3):signIn.emailOtp 建号(emailVerified=true)后,
 * 账号尚无密码;Better Auth 的 setPassword 为 serverOnly 端点,此处做薄封装。
 * 密码规则(≥8 位,含字母和数字)由前端校验;长度下限由 Better Auth 兜底。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "密码格式不正确" } },
      { status: 400 },
    );
  }

  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: await headers(), // 转发会话 Cookie
    });
    return NextResponse.json({ success: true, data: null });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先完成验证" } },
      { status: 401 },
    );
  }
}
