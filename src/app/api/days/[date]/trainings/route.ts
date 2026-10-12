/**
 * POST /api/days/:date/trainings —— 追加当日训练(PRD 3.1.5 / TECH 3.3)
 *
 * 一天多训练追加制(重复添加为追加,不提示覆盖);body 带 cycleId 定位周期
 * (未开始周期可与进行中周期日期重叠,无法仅凭 date 反查)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api-days";
import { parseJsonBody } from "@/lib/api/parse";
import { MUSCLE_GROUPS } from "@/lib/cycles";
import { addTrainingToDay } from "@/lib/db/queries/training-days";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  cycleId: z.string().uuid(),
  name: z.string().min(1).max(30),
  muscleGroups: z
    .array(z.enum(MUSCLE_GROUPS))
    .min(1)
    .refine((arr) => new Set(arr).size === arr.length, { message: "部位不可重复" }),
  today: z.string().regex(DATE_RE).optional(),
});

type Ctx = { params: Promise<{ date: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { date } = await ctx.params;
  if (!z.string().regex(DATE_RE).safeParse(date).success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "日期不合法" } },
      { status: 400 },
    );
  }

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const result = await addTrainingToDay({
    userId,
    cycleId: data.cycleId,
    date,
    name: data.name,
    muscleGroups: data.muscleGroups,
    today: data.today,
  });
  if (!result.ok) {
    return dayError(result.reason);
  }

  return NextResponse.json({ success: true, data: { training: result.data } }, { status: 201 });
}
