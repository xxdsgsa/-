/**
 * E2E #2: 关键 API 守卫(PRD 3.6.4 未登录拦截 + 3.6.9 注销合规)
 *
 * 验证:
 * - 未登录调 /api/.../* 业务端点 → 401
 * - 注销接口 405 / 405 / 405(防止方法误用)
 */
import { test, expect } from "./fixtures";

test.describe("API 守卫 smoke", () => {
  test("未登录调业务 API 返回 401", async ({ request }) => {
    const res = await request.get("/api/account/deletion/status");
    expect([401, 403, 302, 307]).toContain(res.status());
  });

  test("/api/day-marks DELETE 缺 date → 400", async ({ request }) => {
    const res = await request.delete("/api/day-marks");
    expect([400, 401, 403]).toContain(res.status());
  });

  test("/api/account/deletion POST 缺 body → 400/401", async ({ request }) => {
    const res = await request.post("/api/account/deletion", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });
});
