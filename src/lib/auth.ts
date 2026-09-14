/**
 * Better Auth 服务端实例(ADR-6:邮箱+密码 + emailOTP 验证码;绝不自写认证)
 *
 * - 数据:drizzle adapter 落自家 Neon(users/accounts/sessions/verifications 四表)
 * - Session:HttpOnly + SameSite Cookie(Better Auth 默认;红线:Token/Session 不落 localStorage)
 * - 登录限流(3.6.4 近似:15 分钟 5 次)由内置 rateLimit 实现
 */
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { db, schema } from "@/db";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true, // 注册成功即登录(PRD 3.6.2)
  },
  plugins: [
    emailOTP({
      otpLength: 6, // 6 位数字验证码(3.6.2)
      expiresIn: 300, // 5 分钟有效
      // 发码限频:每日 5 次(PRD 3.6.3);60 秒冷却由前端按钮倒计时实现
      rateLimit: { window: 86400, max: 5 },
      async sendVerificationOTP({ email, otp, type }) {
        // 开发期:console 输出(ADR-16 日志分轨);接入 Resend 后在此发送邮件
        // TODO(resend): RESEND_API_KEY 配置后切换为真实发送,当前仅 dev 模式
        console.log(`[auth][dev] OTP(${type}) -> ${email}: ${otp}`);
      },
    }),
    nextCookies(), // Next.js App Router cookie 桥接
  ],
  rateLimit: {
    window: 60,
    max: 100, // 全局默认
    customLimits: {
      // 登录限流(3.6.4:错 5 次锁 15 分钟的近似——按请求次数计)
      "/sign-in/email": { window: 900, max: 5 },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
