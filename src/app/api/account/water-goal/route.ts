/**
 * /api/account/water-goal —— 饮水目标调整(PRD 3.6.7 设置)
 *
 * PUT    body: { waterMl: 500~6000 } 设置手动饮水目标(标记 manualWater=true)
 * DELETE 清除手动标记(恢复按 3.4 自动计算)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/parse";
import { clearWaterGoalManual, setWaterGoal } from "@/lib/db/queries/account";

const bodySchema = z.object({
  waterMl: z.number().int().min(500).max(6000),
});

export async function PUT(req: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema, "饮水目标须在 500~6000ml");
  if (parseError) return parseError;

  const result = await setWaterGoal(userId, data.waterMl);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "保存失败" } },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true, data: { waterMl: result.waterMl, manual: result.manual } });
}

export async function DELETE() {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const result = await clearWaterGoalManual(userId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "尚未设置目标" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: null });
}
