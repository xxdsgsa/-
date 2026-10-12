/**
 * DELETE /api/supplement-logs/[id] —— 删除单条打卡(PRD 3.9.3 左滑删除)
 * 仅当日日志可删(过日让历史不可逆,3.9.5 验收);归属校验在服务层(带 user_id)。
 */
import { NextRequest, NextResponse } from "next/server";

import { requireUserId } from "@/lib/api/auth";
import { parseUuidParam } from "@/lib/api/params";
import { serverToday } from "@/lib/date";
import { deleteSupplementLog } from "@/lib/db/queries/supplements";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const today = serverToday();
  const result = await deleteSupplementLog(userId, id, today);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "打卡记录不存在" } },
      { status: 404 },
    );
  }
  // 客户端用 router.refresh 同步当日次数
  return NextResponse.json({ success: true, data: null });
}
