/**
 * DELETE /api/day-marks?date=YYYY-MM-DD —— 撤销"今日未训练"标记(PRD 3.1.9/3.7.3)
 * 仅当日可撤销(服务端 UTC+8 校验);跨日只读。撤销 = 删行,状态回到未开始。
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverToday } from "@/lib/date";
import { undoMissedMark } from "@/lib/db/queries/training";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function DELETE(req: NextRequest) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const date = new URL(req.url).searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "日期格式不合法" } },
      { status: 400 },
    );
  }
  if (date !== serverToday()) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "仅当日可撤销" } },
      { status: 400 },
    );
  }

  const undone = await undoMissedMark(session.user.id, date);
  if (!undone) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "今日没有未完成标记" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: {} });
}
