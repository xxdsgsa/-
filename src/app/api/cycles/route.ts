/**
 * POST /api/cycles —— 创建训练周期(PRD 3.1.4;onboarding 第 4 步简版)
 *
 * 校验:endDate > startDate;"仅一个进行中"由部分唯一索引兜底
 * (onboarding 场景新用户无旧周期,不会触发;训练模块完整 CRUD 后续扩展)。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createCycle } from "@/lib/db/queries/cycles";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  name: z.string().min(1).max(30),
  startDate: z.string().regex(DATE_RE),
  endDate: z.string().regex(DATE_RE),
  today: z.string().regex(DATE_RE).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const { name, startDate, endDate, today } = parsed.data;
  if (endDate <= startDate) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "结束日期必须晚于开始日期" } },
      { status: 400 },
    );
  }

  const cycle = await createCycle({
    userId: session.user.id,
    name,
    startDate,
    endDate,
    today,
  });

  return NextResponse.json({ success: true, data: { cycle } }, { status: 201 });
}
