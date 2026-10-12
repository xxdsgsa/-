/**
 * addDays / dateRange 测试(从 date-math 导入,避免触发 db 初始化)
 */
import { describe, it, expect } from "vitest";

import { addDays, dateRange } from "@/lib/date-math";

describe("addDays", () => {
  it("同月 +1", () => {
    expect(addDays("2026-09-17", 1)).toBe("2026-09-18");
  });
  it("跨月", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("跨年", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("闰年 2 月 29", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("非闰年 2 月 28 +1 = 3 月 1", () => {
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
  it("0 不变", () => {
    expect(addDays("2026-09-17", 0)).toBe("2026-09-17");
  });
  it("负数向前", () => {
    expect(addDays("2026-09-17", -7)).toBe("2026-09-10");
  });
});

describe("dateRange", () => {
  it("起止同日 → 单元素", () => {
    expect(dateRange("2026-09-17", "2026-09-17")).toEqual(["2026-09-17"]);
  });
  it("3 天闭区间", () => {
    expect(dateRange("2026-09-17", "2026-09-19")).toEqual([
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
  });
  it("跨月", () => {
    const out = dateRange("2026-09-30", "2026-10-02");
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("2026-09-30");
    expect(out[2]).toBe("2026-10-02");
  });
});
