/**
 * GET /api/account/deletion/status —— 注销状态(PRD 3.6.8)
 * 返回:是否冷静期 + 申请时间 + 剩余天数;登录时弹窗用(3.6.8 冷静期取消流程)
 */
import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/api/auth";
import { getDeletionStatus } from "@/lib/db/queries/account";

export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const status = await getDeletionStatus(userId);
  return NextResponse.json({ success: true, data: status });
}
