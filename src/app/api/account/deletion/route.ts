/**
 * /api/account/deletion —— 注销流程(PRD 3.6.8)
 *
 * POST    body: { otp } 提交注销申请,写 deletionRequestedAt = now()
 * DELETE  冷静期内取消注销,清空 deletionRequestedAt
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { consumeDeletionOtp } from "@/lib/auth/otp";
import { cancelDeletion, requestDeletion } from "@/lib/db/queries/account";

const bodySchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "验证码格式不正确"),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema, "请输入 6 位验证码");
  if (parseError) return parseError;

  const ok = await consumeDeletionOtp(userId, data.otp);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_OTP", message: "验证码错误或已过期" } },
      { status: 400 },
    );
  }

  const status = await requestDeletion(userId);
  return NextResponse.json({ success: true, data: status });
}

export async function DELETE() {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const ok = await cancelDeletion(userId);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "账号不存在" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: null });
}
