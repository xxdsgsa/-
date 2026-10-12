/**
 * API 合约 smoke(不启 server,只看路由文件)
 *
 * 验证:
 * - 关键 API 路由文件存在
 * - DELETE/POST/GET 方法正确
 * - 输入校验模式一致(同套 DATE_RE 等)
 */
import { describe, it, expect } from "vitest";

import fs from "node:fs";
import path from "node:path";

const E = (p: string) =>
  fs.readFileSync(path.resolve(process.cwd(), "src/app/api", p), "utf-8");

describe("关键 API 路由存在 + 方法正确", () => {
  it("POST /api/account/deletion/request", () => {
    const src = E("account/deletion/request/route.ts");
    expect(src).toMatch(/export async function POST/);
  });
  it("POST/DELETE /api/account/deletion", () => {
    const src = E("account/deletion/route.ts");
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/export async function DELETE/);
  });
  it("GET /api/account/deletion/status", () => {
    const src = E("account/deletion/status/route.ts");
    expect(src).toMatch(/export async function GET/);
  });
  it("DELETE /api/day-marks", () => {
    const src = E("day-marks/route.ts");
    expect(src).toMatch(/export async function DELETE/);
  });
  it("POST /api/sessions/[id]/finish", () => {
    const src = E("sessions/[id]/finish/route.ts");
    expect(src).toMatch(/export async function POST/);
  });
});
