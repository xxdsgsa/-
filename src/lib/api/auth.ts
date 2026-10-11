/**
 * API 路由鉴权 helper(Batch 3 refactor)
 *
 * 现状:27 个 API 路由每个都重复 ~10 行
 *   const session = await auth.api.getSession(...).catch(() => null);
 *   if (!session) return NextResponse.json({...}, { status: 401 });
 *   // ... use session.user.id
 *
 * 重构后:
 *   const { userId, error } = await requireUserId();
 *   if (error) return error;
 *   // ... use userId
 *
 * 行为零变化:响应体 + status code 与重构前完全一致(用统一的 UNAUTHORIZED 响应体)。
 * catch 行为统一为 `.catch(() => null)`,即使 Better Auth 内部抛错也返回 401 而非 500。
 *
 * 不导出 requireUser():若有路由需要 session.user.name 之类的非 id 字段,可后续扩展,
 * 现在 27 个路由 grep 验证,只有 0 个路由读 name/user 其它字段,先不开第二个 helper。
 */
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export type RequireUserIdResult =
  | { userId: string; error: null }
  | { userId: null; error: NextResponse };

/** API 路由用:从 HttpOnly Cookie 拿 session,未登录返回 401 NextResponse;已登录返回 userId */
export async function requireUserId(): Promise<RequireUserIdResult> {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) {
    return {
      userId: null,
      error: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      ),
    };
  }
  return { userId: session.user.id, error: null };
}
