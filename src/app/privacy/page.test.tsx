/**
 * 隐私 / 协议 / 多设备说明测试
 *
 * 这两个页面是公开路由(/privacy /agreement)不需要登录;验证:
 * - 文件可被 require(避免被意外改成 server component 错配)
 * - 内容含"多设备" 关键词(3.6.8 规则文档化)
 */
import { describe, it, expect } from "vitest";

import fs from "node:fs";
import path from "node:path";

const SRC = (p: string) =>
  fs.readFileSync(path.resolve(process.cwd(), "src/app", p), "utf-8");

describe("隐私 / 协议 公开页(无需登录)", () => {
  it("/privacy 存在多设备规则说明(3.6.8)", () => {
    const src = SRC("privacy/page.tsx");
    expect(src).toMatch(/多设备/);
    expect(src).toMatch(/3\.6\.8/);
  });
  it("/agreement 包含注销说明(3.6.8 AUTH-004)", () => {
    const src = SRC("agreement/page.tsx");
    expect(src).toMatch(/注销/);
  });
});
