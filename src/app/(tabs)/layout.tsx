/**
 * Tab 结构布局(PRD 2.3.2:首页/训练/饮食/数据/我的)
 * 登录/注册与 onboarding 为进入 Tab 结构前的独立流程(2.3.2)——
 * 本路由组统一守卫:未登录 → /login;未完成首次设置 → /onboarding。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { auth } from "@/lib/auth";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");
  if (!session.user.onboardedAt) redirect("/onboarding");

  return (
    <div className="min-h-dvh pb-16">
      {children}
      <BottomNav />
    </div>
  );
}
