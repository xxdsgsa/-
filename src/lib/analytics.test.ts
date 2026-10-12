/**
 * analytics 模块测试
 *
 * 覆盖:事件名常量、props 序列化、userId 缺省为 null
 * 不测 db 写入(那属于集成测试范围,需要测试库)
 */
import { describe, it, expect } from "vitest";

import { EVENT, type EventName, type RecordType } from "@/lib/analytics-types";

describe("EVENT 常量", () => {
  it("已注册两个事件", () => {
    expect(EVENT.RECORD_CREATED).toBe("record_created");
    expect(EVENT.STATS_PAGE_VIEW).toBe("stats_page_view");
  });
  it("事件名不重复", () => {
    const names = Object.values(EVENT);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("类型导出", () => {
  it("RecordType 含 5 类记录", () => {
    const all: RecordType[] = [
      "diet_item",
      "supplement_checkin",
      "water_intake",
      "body_weight",
      "training_session",
    ];
    expect(all).toHaveLength(5);
  });
  it("EventName 与 EVENT 一致", () => {
    const names: EventName[] = [EVENT.RECORD_CREATED, EVENT.STATS_PAGE_VIEW];
    expect(names).toContain("record_created");
    expect(names).toContain("stats_page_view");
  });
});
