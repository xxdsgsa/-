import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 配置(TECH 附录 A)
 *
 * 3 条主流程:
 * 1. 注册→首次设置→创建周期并添加动作
 * 2. 执行训练(含中断恢复)→总结
 * 3. 记录一餐+饮水+补剂→首页卡片核对
 *
 * 注:E2E 默认需要运行中的 dev server;baseURL 走 http://localhost:3000
 *    生产可走 E2E_BASE_URL 覆盖
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // 共享同一个 db 状态,顺序执行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // 单 worker(避免并发写同一 db 干扰)
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // 测试邮箱统一前缀
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
