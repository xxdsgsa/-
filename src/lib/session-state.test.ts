/**
 * 训练 session 状态机测试(3.1.10 中断恢复 + 3.2.7 提前结束)
 */
import { describe, it, expect } from "vitest";

import { decideStart } from "@/lib/session-state";

const TODAY = "2026-10-12";

describe("decideStart (3.1.10 训练执行)", () => {
  it("休息日 → NOT_FOUND", () => {
    expect(
      decideStart({ today: TODAY, trainingDayDate: TODAY, isRest: true, existingStatus: "none" }),
    ).toEqual({ reason: "NOT_FOUND", resumed: false });
  });
  it("非当天训练 → NOT_TODAY", () => {
    expect(
      decideStart({ today: TODAY, trainingDayDate: "2026-10-11", isRest: false, existingStatus: "none" }),
    ).toEqual({ reason: "NOT_TODAY", resumed: false });
  });
  it("无现有 session → 新开", () => {
    expect(
      decideStart({ today: TODAY, trainingDayDate: TODAY, isRest: false, existingStatus: "none" }),
    ).toEqual({ reason: "OK_NEW", resumed: false });
  });
  it("进行中 session → 中断恢复(幂等)", () => {
    expect(
      decideStart({ today: TODAY, trainingDayDate: TODAY, isRest: false, existingStatus: "进行中" }),
    ).toEqual({ reason: "OK_RESUMED", resumed: true });
  });
  it("已完成 session → SESSION_DONE(不可重开)", () => {
    expect(
      decideStart({ today: TODAY, trainingDayDate: TODAY, isRest: false, existingStatus: "已完成" }),
    ).toEqual({ reason: "SESSION_DONE", resumed: false });
  });
});
