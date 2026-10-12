/**
 * 训练域写操作错误映射(服务层 reason → HTTP 响应)
 * 供 /api/days/*、/api/trainings/*、/api/training-items/*、/api/exercises/* 共用,保证文案一致。
 */
import { NextResponse } from "next/server";

const MAP: Record<string, { code: string; message: string; status: number }> = {
  NOT_FOUND: { code: "NOT_FOUND", message: "周期、训练或动作不存在", status: 404 },
  DATE_OUT_OF_RANGE: { code: "VALIDATION_ERROR", message: "该日期不在周期内", status: 400 },
  PAST_DATE: { code: "VALIDATION_ERROR", message: "历史日期只读,不可修改", status: 400 },
  IS_REST: { code: "VALIDATION_ERROR", message: "休息日不可添加训练,请先取消休息日", status: 400 },
  HAS_RECORDS: { code: "CONFLICT", message: "已有执行记录,无法删除", status: 409 },
  OFFICIAL_EXERCISE: { code: "FORBIDDEN", message: "官方动作不可修改或删除", status: 403 },
  NOT_TODAY: { code: "VALIDATION_ERROR", message: "只能执行今天的训练", status: 400 },
  SESSION_DONE: { code: "CONFLICT", message: "该训练已完成", status: 409 },
  SESSION_CONFLICT: { code: "CONFLICT", message: "有未结束的训练,请先继续或结束它", status: 409 },
  NOT_IN_PROGRESS: { code: "VALIDATION_ERROR", message: "训练已结束", status: 400 },
};

export function dayError(reason: string): NextResponse {
  const e = MAP[reason] ?? { code: "INTERNAL_ERROR", message: "操作失败", status: 500 };
  return NextResponse.json(
    { success: false, error: { code: e.code, message: e.message } },
    { status: e.status },
  );
}
