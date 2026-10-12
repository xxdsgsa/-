/**
 * 训练 session 状态机纯函数(3.1.10 训练执行 + 3.2.7 异常)
 *
 * startSession / finishSession 在 db 层;这里抽"输入 → 期望原因"映射供测试
 *
 * 规则(3.1.10):
 * - 进行中 session 同 trainingId 再次 startSession → 幂等(resumed: true)
 * - 已完成 session 再次 startSession → SESSION_DONE
 * - 非当天训练 → NOT_TODAY
 * - 跨训练进行中 → SESSION_CONFLICT
 * - 休息日 → 视作 NOT_FOUND
 *
 * 规则(3.2.7):
 * - 提前结束:完成 ≥1 组 → 实际为"已完成";0 组 → 实际为"未完成"
 *   → 4 态判定由 stats 层根据 set_logs 聚合,不在此层
 */

import type { SessionMutationReason } from "@/lib/db/queries/training-sessions";

export interface StartInput {
  /** 当天日期(由调用方传入) */
  today: string;
  /** training 的当天日期 */
  trainingDayDate: string;
  /** 是否休息日 */
  isRest: boolean;
  /** 已有 session 状态 */
  existingStatus: "none" | "进行中" | "已完成";
}

export type StartResultReason = "OK_NEW" | "OK_RESUMED" | SessionMutationReason;

/**
 * 决定 startSession 应返回的结果(纯函数,无 db)
 */
export function decideStart(input: StartInput): {
  reason: StartResultReason;
  resumed: boolean;
} {
  if (input.isRest) return { reason: "NOT_FOUND", resumed: false };
  if (input.trainingDayDate !== input.today) return { reason: "NOT_TODAY", resumed: false };
  if (input.existingStatus === "进行中") return { reason: "OK_RESUMED", resumed: true };
  if (input.existingStatus === "已完成") return { reason: "SESSION_DONE", resumed: false };
  return { reason: "OK_NEW", resumed: false };
}
