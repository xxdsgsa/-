/**
 * Tab 结构布局(PRD 2.3.2:首页/训练/饮食/数据/我的)
 * 登录/注册与 onboarding 为进入 Tab 结构前的独立流程(2.3.2)——
 * 本路由组统一守卫:未登录 → /login;未完成首次设置 → /onboarding。
 *
 * 守卫判据:用 DB 侧 isOnboarded() 查询 users.onboarded_at,不再依赖
 * session payload 中 additionalFields 的透传(Batch 1 修复,2026-10-11)。
 * 即便 Better Auth session 不带 onboardedAt 字段,守卫也始终可信。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { auth } from "@/lib/auth";
import { isOnboarded } from "@/lib/db/queries/onboarding";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  // Better Auth 从 cookie 还原 session;失败返回 null。
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");
  if (!(await isOnboarded(session.user.id))) redirect("/onboarding");

  return (
    <div className="min-h-dvh pb-16">
      {children}
      <BottomNav />
    </div>
  );
}
