/**
 * 当日 / 跨日判定测试(3.1.9 撤销可用性 + 3.2.8 历史只读)
 */
import { describe, it, expect } from "vitest";

import { isPastDay, isToday } from "@/lib/date-guard";

const TODAY = "2026-10-12";

describe("isToday", () => {
  it("与 today 同 → true", () => {
    expect(isToday(TODAY, TODAY)).toBe(true);
  });
  it("昨天 → false", () => {
    expect(isToday("2026-10-11", TODAY)).toBe(false);
  });
  it("明天 → false(未来日不可撤销)", () => {
    expect(isToday("2026-10-13", TODAY)).toBe(false);
  });
});

describe("isPastDay (3.2.8 历史只读)", () => {
  it("昨天 → true", () => {
    expect(isPastDay("2026-10-11", TODAY)).toBe(true);
  });
  it("今天 → false", () => {
    expect(isPastDay(TODAY, TODAY)).toBe(false);
  });
  it("明天 → false(未来日不是 past)", () => {
    expect(isPastDay("2026-10-13", TODAY)).toBe(false);
  });
  it("跨月过去", () => {
    expect(isPastDay("2026-09-30", TODAY)).toBe(true);
  });
  it("跨年过去", () => {
    expect(isPastDay("2025-12-31", TODAY)).toBe(true);
  });
});
