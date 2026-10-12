/**
 * DELETE /api/water-logs/[id] —— 删除单条饮水记录(PRD 3.10.3 左滑删除)
 * 仅当日日志可删(过日历史不可逆,3.10.3);归属校验(带 user_id)。
 */
import { NextRequest, NextResponse } from "next/server";

import { requireUserId } from "@/lib/api/auth";
import { parseUuidParam } from "@/lib/api/params";
import { deleteWaterLog } from "@/lib/db/queries/water";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const ok = await deleteWaterLog(userId, id);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "记录不存在或非当日" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: null });
}
