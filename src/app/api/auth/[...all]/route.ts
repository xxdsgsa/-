/**
 * Better Auth catch-all 路由(TECH 第三部分:A-* 认证端点)
 *
 * 挂载后可用端点(节选):
 *   POST /api/auth/sign-up/email          注册(邮箱+密码)
 *   POST /api/auth/sign-in/email          登录
 *   POST /api/auth/sign-out               退出
 *   GET  /api/auth/get-session            读取会话
 *   POST /api/auth/email-otp/send-verification-otp  发送验证码
 *   POST /api/auth/email-otp/verify-verification-otp 校验验证码
 *   GET  /api/auth/ok                     健康检查
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
