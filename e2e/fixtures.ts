/**
 * E2E 共享工具
 * - 监听服务端 console 抓 OTP(开发期 OTP 在服务端终端)
 * - 提供 signUp → onboard 端到端
 */
import { test as base, expect, type Page, type ConsoleMessage } from "@playwright/test";

export const TEST = {
  email: `e2e-${Date.now()}@fitmate.test`,
  password: "Test1234abcd",
  nickname: "E2E Tester",
};

export { expect };

/** 监听控制台并解析 OTP 行(开发期格式:`[auth][dev] OTP(...) -> email: 123456`) */
export function attachOtpCatcher(page: Page): { getLatest: () => string | null } {
  const otps: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    const text = msg.text();
    const m = text.match(/OTP\([^)]+\)\s*->\s*[^:]+:\s*(\d{6})/);
    if (m) otps.push(m[1]);
  };
  page.on("console", handler);
  return {
    getLatest: () => otps[otps.length - 1] ?? null,
  };
}

/** 完整注册 + onboarding(只跑一次,各 spec 共用) */
export async function registerAndOnboard(page: Page, email: string) {
  const otp = attachOtpCatcher(page);

  // 1. 打开注册
  await page.goto("/signup");
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();

  // 2. 等 OTP
  await expect.poll(() => otp.getLatest(), { timeout: 5000 }).not.toBeNull();
  const code = otp.getLatest()!;
  await page.getByLabel("验证码").fill(code);

  // 3. 密码
  await page.getByLabel("密码").fill(TEST.password);
  await page.getByLabel("确认密码").fill(TEST.password);

  // 4. 协议(如有 checkbox)
  const agree = page.locator('input[type="checkbox"]');
  if (await agree.count() > 0) await agree.first().check();

  // 5. 提交注册(成功 → onboarding)
  await page.getByRole("button", { name: /注册|下一步/ }).first().click();

  // 6. onboarding 4 步:基础信息 → 目标 → 营养预览 → 跳过创建周期
  await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
}

export const test = base;
