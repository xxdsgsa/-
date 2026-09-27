/**
 * 训练日写操作错误映射(服务层 reason → HTTP 响应)
 * 供 /api/days/* 与 /api/trainings/* 路由共用,保证文案一致。
 */
import { NextResponse } from "next/server";

const MAP: Record<string, { code: string; message: string; status: number }> = {
  NOT_FOUND: { code: "NOT_FOUND", message: "周期或训练不存在", status: 404 },
  DATE_OUT_OF_RANGE: { code: "VALIDATION_ERROR", message: "该日期不在周期内", status: 400 },
  PAST_DATE: { code: "VALIDATION_ERROR", message: "历史日期只读,不可修改", status: 400 },
  IS_REST: { code: "VALIDATION_ERROR", message: "休息日不可添加训练,请先取消休息日", status: 400 },
  HAS_RECORDS: { code: "CONFLICT", message: "该训练已有执行记录,无法删除", status: 409 },
};

export function dayError(reason: string): NextResponse {
  const e = MAP[reason] ?? { code: "INTERNAL_ERROR", message: "操作失败", status: 500 };
  return NextResponse.json(
    { success: false, error: { code: e.code, message: e.message } },
    { status: e.status },
  );
}
