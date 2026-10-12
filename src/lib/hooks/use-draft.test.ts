/**
 * use-draft 草稿存储测试(PRD 3.3.4 / 3.3.5)
 *
 * 覆盖:
 * - 写 → 读 还原
 * - 7 天 TTL 自动失效
 * - 缺 key / 解析失败 → null
 * - clearDraft 真删
 * - draftKey 命名空间/用户隔离
 *
 * happy-dom 提供 window/localStorage
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearDraft,
  draftKey,
  loadDraft,
  saveDraft,
} from "@/lib/hooks/use-draft";

const KEY = draftKey("test", "user-1", "form-A");

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe("saveDraft + loadDraft", () => {
  it("写后读出原数据", () => {
    saveDraft(KEY, { name: "Alice", age: 30 });
    expect(loadDraft<{ name: string; age: number }>(KEY)).toEqual({ name: "Alice", age: 30 });
  });

  it("空 key 返回 null", () => {
    expect(loadDraft("nonexistent")).toBeNull();
  });

  it("解析失败返回 null 并清掉坏数据", () => {
    localStorage.setItem(KEY, "这不是 JSON{{");
    expect(loadDraft(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("TTL 7 天 (3.3.4)", () => {
  it("超过 7 天的草稿返回 null 并自动清掉", () => {
    const expired = {
      savedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      data: { x: 1 },
    };
    localStorage.setItem(KEY, JSON.stringify(expired));
    expect(loadDraft<{ x: number }>(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("恰好 7 天的边界:测试 6.9 天(仍在 7 天内)", () => {
    const ok = {
      savedAt: new Date(Date.now() - 6.9 * 24 * 3600 * 1000).toISOString(),
      data: { ok: true },
    };
    localStorage.setItem(KEY, JSON.stringify(ok));
    expect(loadDraft<{ ok: boolean }>(KEY)).toEqual({ ok: true });
  });
});

describe("clearDraft", () => {
  it("删后 loadDraft 为 null", () => {
    saveDraft(KEY, { x: 1 });
    expect(loadDraft(KEY)).not.toBeNull();
    clearDraft(KEY);
    expect(loadDraft(KEY)).toBeNull();
  });
});

describe("draftKey 命名", () => {
  it("fitmate:draft:namespace:userId:formId", () => {
    expect(draftKey("supplement", "u-1", "new")).toBe("fitmate:draft:supplement:u-1:new");
  });
  it("不同 userId → 不同 key(隔离)", () => {
    const a = draftKey("supplement", "user-1", "new");
    const b = draftKey("supplement", "user-2", "new");
    expect(a).not.toBe(b);
  });
  it("不同 formId → 不同 key", () => {
    expect(draftKey("supplement", "u-1", "new")).not.toBe(draftKey("supplement", "u-1", "edit-42"));
  });
});
