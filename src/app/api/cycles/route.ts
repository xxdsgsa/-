/**
 * POST /api/cycles —— 创建训练周期(PRD 3.1.4)
 *
 * 校验:endDate > startDate;startDate ≤ 今日时新周期即为"进行中",
 * 若已有进行中周期 → 409 返回其名称,前端弹"结束并激活新周期?"确认后带 force 重发。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { createCycle } from "@/lib/db/queries/cycles";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  name: z.string().min(1).max(30),
  startDate: z.string().regex(DATE_RE),
  endDate: z.string().regex(DATE_RE),
  today: z.string().regex(DATE_RE).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const { name, startDate, endDate, today, force } = parsed.data;
  if (endDate <= startDate) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "结束日期必须晚于开始日期" } },
      { status: 400 },
    );
  }

  const result = await createCycle({
    userId,
    name,
    startDate,
    endDate,
    today,
    force,
  });
  if (!result.ok) {
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

  return NextResponse.json({ success: true, data: { cycle: result.cycle } }, { status: 201 });
}
