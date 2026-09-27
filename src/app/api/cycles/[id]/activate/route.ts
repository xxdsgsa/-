/**
 * POST /api/cycles/:id/activate —— 手动激活周期(PRD 3.1.4 / TECH 3.3)
 *
 * 已有进行中周期 → 409 返回其名称,前端弹"结束并激活新周期?"确认后带 force 重发;
 * 已结束周期不可复活(生命周期终点)。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { activateCycle } from "@/lib/db/queries/cycles";

const bodySchema = z.object({
  force: z.boolean().optional(),
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
      { success: false, error: { code: "VALIDATION_ERROR", message: "周期 ID 不合法" } },
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

  const result = await activateCycle({
    userId: session.user.id,
    id,
    force: parsed.data.force,
  });
  if (!result.ok) {
    if (result.reason === "ACTIVE_CONFLICT") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACTIVE_CYCLE_CONFLICT",
            message: `当前周期『${result.activeCycle.name}』仍在进行中,是否结束并激活新周期?`,
            activeCycle: { id: result.activeCycle.id, name: result.activeCycle.name },
          },
        },
        { status: 409 },
      );
    }
    if (result.reason === "NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "周期不存在" } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "周期已结束,无法重新激活" } },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, data: { cycle: result.cycle } });
}
