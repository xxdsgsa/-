/**
 * POST /api/sessions/:id/skip-item —— 跳过动作(PRD 3.1.10/3.2.7)
 *
 * 该动作剩余未完成组批量生成 completed=false 行(已完成组不动),记"未完成"进入下一动作。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { dayError } from "@/lib/api-days";
import { skipItem } from "@/lib/db/queries/training-sessions";

const bodySchema = z.object({
  trainingItemId: z.string().uuid(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const result = await skipItem({
    userId: session.user.id,
    sessionId: id,
    trainingItemId: parsed.data.trainingItemId,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null });
}
