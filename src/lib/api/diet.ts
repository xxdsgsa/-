/**
 * 饮食域写操作错误映射(服务层 reason → HTTP 响应)
 * 供 /api/foods/*、/api/diet/items/* 共用,保证文案一致。
 */
import { NextResponse } from "next/server";

const MAP: Record<string, { code: string; message: string; status: number }> = {
  NOT_FOUND: { code: "NOT_FOUND", message: "食物或饮食记录不存在", status: 404 },
  DATE_OUT_OF_WINDOW: {
    code: "VALIDATION_ERROR",
    message: "超出 7 天补记窗口,该日期只读",
    status: 400,
  },
  OFFICIAL_FOOD: { code: "FORBIDDEN", message: "官方食物不可修改或删除", status: 403 },
};

export function dietError(reason: string): NextResponse {
  const e = MAP[reason] ?? { code: "INTERNAL_ERROR", message: "操作失败", status: 500 };
  return NextResponse.json(
    { success: false, error: { code: e.code, message: e.message } },
    { status: e.status },
  );
}
