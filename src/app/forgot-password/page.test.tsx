/**
 * 忘记密码 / 注册 共用正则测试
 * 这些常量散在两个页面中,易漂移;抽到 lib/validators 集中,避免被业务漏改
 */
import { describe, it, expect } from "vitest";

import { EMAIL_RE, PASSWORD_RE } from "@/lib/validators";

describe("EMAIL_RE", () => {
  it("合法邮箱", () => {
    expect(EMAIL_RE.test("a@b.c")).toBe(true);
    expect(EMAIL_RE.test("foo.bar+tag@example.co")).toBe(true);
  });
  it("非法", () => {
    expect(EMAIL_RE.test("")).toBe(false);
    expect(EMAIL_RE.test("plainstring")).toBe(false);
    expect(EMAIL_RE.test("a@b")).toBe(false); // 缺 TLD
    expect(EMAIL_RE.test("@b.com")).toBe(false);
    expect(EMAIL_RE.test("a@.com")).toBe(false);
  });
});

describe("PASSWORD_RE (≥8 位 + 字母 + 数字)", () => {
  it("合法", () => {
    expect(PASSWORD_RE.test("abcd1234")).toBe(true);
    expect(PASSWORD_RE.test("Aa123456")).toBe(true);
    expect(PASSWORD_RE.test("1234abcd")).toBe(true);
  });
  it("位数不足", () => {
    expect(PASSWORD_RE.test("a1b2c3")).toBe(false);
  });
  it("缺字母", () => {
    expect(PASSWORD_RE.test("12345678")).toBe(false);
  });
  it("缺数字", () => {
    expect(PASSWORD_RE.test("abcdefgh")).toBe(false);
  });
});
