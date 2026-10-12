/**
 * E2E #3: 多设备 / 数据一致 文档可达(PRD 3.6.8 + 4.4 验收"多设备登录数据一致")
 *
 * 策略:云端权威 + RSC 拉取,无独立"多设备"端点;这里验证:
 * - 隐私页 6 节"多设备登录"存在(3.6.8 文档化)
 * - 协议页 5 节"账号注销"存在
 * - 404 路由有友好兜底
 */
import { test, expect } from "./fixtures";

test.describe("多设备 / 注销 / 404", () => {
  test("/privacy 含 3.6.8 多设备说明", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/多设备/)).toBeVisible();
    await expect(page.getByText(/云端为权威/)).toBeVisible();
  });

  test("/agreement 含 AUTH-004 注销 + 15 天冷静期", async ({ page }) => {
    await page.goto("/agreement");
    await expect(page.getByText(/账号注销/)).toBeVisible();
    await expect(page.getByText(/15 天/)).toBeVisible();
  });

  test("未知路径 → 404", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist");
    expect(res?.status()).toBe(404);
  });
});
