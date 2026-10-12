/**
 * SessionSummary 视图测试(纯函数部分:weekdayCN + 容量计算可单测)
 *
 * 实际 SQL 聚合部分不在此覆盖(需要测试库),只测纯函数与计算逻辑。
 */
import { describe, it, expect } from "vitest";

import { weekdayCN } from "@/lib/cycles";
import { formatDuration } from "@/lib/date";
import { calcVolumeFromLogs } from "@/lib/summary-calc";

describe("weekdayCN (3.5 顶部日期)", () => {
  it("2026-09-11 是周五", () => {
    expect(weekdayCN("2026-09-11")).toBe("周五");
  });
  it("2026-09-12 是周六", () => {
    expect(weekdayCN("2026-09-12")).toBe("周六");
  });
  it("2026-09-13 是周日", () => {
    expect(weekdayCN("2026-09-13")).toBe("周日");
  });
});

describe("formatDuration 边界 (3.5 概要总时长)", () => {
  it("0 秒", () => {
    expect(formatDuration(0)).toBe("0秒");
  });
  it("超长(2 小时 30 分)", () => {
    expect(formatDuration(2 * 3600 + 30 * 60)).toBe("2小时30分钟");
  });
});

describe("calcVolumeFromLogs (3.5 容量)", () => {
  it("空 → 0", () => {
    expect(calcVolumeFromLogs([])).toBe(0);
  });
  it("已完成组的重量 × 次数累加", () => {
    const logs = [
      { actualWeight: 60, actualReps: 10, completed: true },
      { actualWeight: 80, actualReps: 8, completed: true },
    ];
    // 60*10 + 80*8 = 600 + 640 = 1240
    expect(calcVolumeFromLogs(logs)).toBe(1240);
  });
  it("未完成组不计入", () => {
    const logs = [
      { actualWeight: 100, actualReps: 10, completed: true },
      { actualWeight: 100, actualReps: 10, completed: false },
    ];
    expect(calcVolumeFromLogs(logs)).toBe(1000);
  });
  it("无重量记录按 0 计入(3.5.3 不折算)", () => {
    const logs = [
      { actualWeight: null, actualReps: 15, completed: true },
      { actualWeight: 50, actualReps: 10, completed: true },
    ];
    // 0*15 + 50*10 = 500
    expect(calcVolumeFromLogs(logs)).toBe(500);
  });
});
