/**
 * 注销冷静期纯函数测试(PRD 3.6.8)
 */
import { describe, it, expect } from "vitest";

import { calcCoolingRemaining, isCoolingExpired } from "@/lib/account-calc";

const NOW = new Date("2026-10-12T00:00:00Z").getTime();
const day = 24 * 3600 * 1000;

describe("calcCoolingRemaining (3.6.8 冷静期 15 天)", () => {
  it("刚申请 → 15 天", () => {
    expect(calcCoolingRemaining(new Date(NOW), NOW)).toBe(15);
  });
  it("申请 5 天后 → 10 天", () => {
    expect(calcCoolingRemaining(new Date(NOW - 5 * day), NOW)).toBe(10);
  });
  it("申请 14.5 天后 → 1 天(向上取整)", () => {
    expect(calcCoolingRemaining(new Date(NOW - 14.5 * day), NOW)).toBe(1);
  });
  it("申请 15 天后 → 0 天(今天到期)", () => {
    expect(calcCoolingRemaining(new Date(NOW - 15 * day), NOW)).toBe(0);
  });
  it("申请 16 天后 → -1(已超期可物理删除)", () => {
    expect(calcCoolingRemaining(new Date(NOW - 16 * day), NOW)).toBe(-1);
  });
});

describe("isCoolingExpired", () => {
  it("冷静期内 → false", () => {
    expect(isCoolingExpired(new Date(NOW - 1 * day), NOW)).toBe(false);
  });
  it("恰好 15 天 → false(还是冷静期)", () => {
    expect(isCoolingExpired(new Date(NOW - 15 * day), NOW)).toBe(false);
  });
  it("16 天后 → true(可删)", () => {
    expect(isCoolingExpired(new Date(NOW - 16 * day), NOW)).toBe(true);
  });
});
