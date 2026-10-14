/**
 * 全局 Edge Proxy(Next.js 16: middleware 已重命名为 proxy)
 *
 * 职责:
 *  1. 受保护页面统一守卫(SSR 阶段拦截未登录用户 → /login)
 *  2. 已登录用户访问 /welcome /login /signup → /dashboard
 *  3. Session 检查走 Better Auth cookie 校验,失败一律 401/重定向,不依赖 DB
 *
 * 边缘约束:
 *  - proxy 跑在 Edge runtime,不能 import Drizzle / 业务库
 *  - Session 校验通过 Better Auth 提供的 cookie 解析(轻量,不查 DB)
 *  - 路由白名单:/login /signup /forgot-password /agreement /privacy /api/auth/*
 *  - matcher 排除静态资源 + _next
 */
import { NextResponse, type NextRequest } from "next/server";

// Better Auth 默认 cookie 名(可被 BETTER_AUTH_COOKIE_NAME 覆盖)
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/agreement",
  "/privacy",
  "/welcome",
];

const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublic(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  return PUBLIC_API_PREFIXES.some((p) => path.startsWith(p));
}

function hasSession(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => req.cookies.get(name)?.value);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 公开路由:放行
  if (isPublic(pathname)) {
    // 已登录用户访问 /login /signup /welcome → 推回 /dashboard
    if (
      hasSession(req) &&
      ["/login", "/signup", "/welcome"].includes(pathname)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // API 路由:已由每个 route 的 requireUserId() 守卫,这里不重复;
  // 仅兜底:对 /api/auth/* 之外的 API 也加 cookie 检查,避免未鉴权打到业务代码
  if (pathname.startsWith("/api/")) {
    if (!hasSession(req)) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // 业务页面:未登录 → /login
  if (!hasSession(req)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 排除静态资源 / _next / favicon / manifest
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)",
  ],
};
