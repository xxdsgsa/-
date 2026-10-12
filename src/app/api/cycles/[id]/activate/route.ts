/**
 * POST /api/cycles/:id/activate —— 手动激活周期(PRD 3.1.4 / TECH 3.3)
 *
 * 已有进行中周期 → 409 返回其名称,前端弹"结束并激活新周期?"确认后带 force 重发;
 * 已结束周期不可复活(生命周期终点)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { parseUuidParam } from "@/lib/api/params";
import { activateCycle } from "@/lib/db/queries/cycles";

const bodySchema = z.object({
  force: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { value: id, error: idError } = await parseUuidParam(ctx, "id", "周期 ID 不合法");
  if (idError) return idError;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const result = await activateCycle({
    userId,
    id,
    force: data.force,
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
