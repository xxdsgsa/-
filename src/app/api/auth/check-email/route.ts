/**
 * 邮箱存在性检查(PRD 3.6.3:已注册 → 提示"该邮箱已注册,请登录")
 *
 * 注册页在发送验证码前调用。仅返回布尔,不泄露其他信息。
 */
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";

const emailSchema = z.string().email().max(255).toLowerCase();

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("email");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "邮箱格式不正确" } },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data))
    .limit(1);

  return NextResponse.json({ success: true, data: { exists: !!existing } });
}
