/**
 * 日期工具测试(PRD 3.5/3.8.8:今日边界、UTC+8 语义)
 */
import { describe, it, expect } from "vitest";

import { formatDateLabel, formatDuration } from "@/lib/date";

describe("formatDateLabel", () => {
  it("标准 yyyy-mm-dd → m月d日(去前导零)", () => {
    expect(formatDateLabel("2026-09-17")).toBe("9月17日");
    expect(formatDateLabel("2026-01-05")).toBe("1月5日");
    expect(formatDateLabel("2026-12-31")).toBe("12月31日");
  });
  it("单数月/日不补零", () => {
    expect(formatDateLabel("2026-02-09")).toBe("2月9日");
  });
});

describe("formatDuration (3.5 总结页)", () => {
  it("< 60s → 秒", () => {
    expect(formatDuration(0)).toBe("0秒");
    expect(formatDuration(45)).toBe("45秒");
    expect(formatDuration(59)).toBe("59秒");
  });
  it("仅分钟", () => {
    expect(formatDuration(60)).toBe("1分钟");
    expect(formatDuration(58 * 60)).toBe("58分钟");
  });
  it(">1h 包含小时+分钟", () => {
    expect(formatDuration(3600)).toBe("1小时0分钟");
    expect(formatDuration(3600 + 5 * 60)).toBe("1小时5分钟");
  });
  it("3599s 算 60 分钟(因 h=0,函数不向上取整到 1h——这是产品决策,后续若要改 1h 改 formatDuration)", () => {
    expect(formatDuration(3599)).toBe("60分钟");
  });
});
