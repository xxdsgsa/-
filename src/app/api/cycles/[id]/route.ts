/**
 * PATCH /api/cycles/:id —— 编辑周期;DELETE /api/cycles/:id —— 删除周期(PRD 3.1.4 / 3.1.11)
 *
 * 日期编辑成对提交(表单始终 name+两日期齐发,仅改名时无日期);
 * 删除为软删:计划数据隐藏,训练历史完整保留。
 *
 * 鉴权:requireUserId() helper 取代 27 处样板(Batch 3 refactor)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { DATE_RE } from "@/lib/api/params";
import { parseJsonBody } from "@/lib/api/parse";
import { deleteCycle, updateCycle } from "@/lib/db/queries/cycles";

const patchSchema = z
  .object({
    name: z.string().min(1).max(30).optional(),
    startDate: z.string().regex(DATE_RE).optional(),
    endDate: z.string().regex(DATE_RE).optional(),
    today: z.string().regex(DATE_RE).optional(),
  })
  .refine((d) => d.name !== undefined || d.startDate !== undefined, {
    message: "至少提供一个修改字段",
  })
  .refine((d) => (d.startDate ?? d.endDate) === undefined || (d.startDate !== undefined && d.endDate !== undefined), {
    message: "日期必须成对提交",
  });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "周期 ID 不合法" } },
      { status: 400 },
    );
  }

  const { data, error: parseError } = await parseJsonBody(req, patchSchema);
  if (parseError) return parseError;

  const { name, startDate, endDate, today } = data;
  if (startDate !== undefined && endDate !== undefined && endDate <= startDate) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "结束日期必须晚于开始日期" } },
      { status: 400 },
    );
  }

  const result = await updateCycle({
    userId,
    id,
    name,
    startDate,
    endDate,
    today,
  });
  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "周期不存在" } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ACTIVE_CYCLE_CONFLICT",
          message: `当前周期『${result.activeCycle.name}』仍在进行中,无法将本周期改为进行中`,
          activeCycle: { id: result.activeCycle.id, name: result.activeCycle.name },
        },
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data: { cycle: result.cycle } });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "周期 ID 不合法" } },
      { status: 400 },
    );
  }

  const deleted = await deleteCycle(userId, id);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "周期不存在" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: {} });
}
