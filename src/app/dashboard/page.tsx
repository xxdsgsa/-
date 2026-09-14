/**
 * 首页占位(PRD 3.7 Dashboard 的最小骨架)
 * 会话守卫:未登录 → /login。后续在此实现五卡片布局(3.7.2)。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const nickname = session.user.name || "FitMate 用户";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-2xl font-bold">你好,{nickname}</h1>
        <p className="text-muted-foreground">首页建设中 · 数据概览将在这里呈现</p>
      </div>
      <SignOutButton />
    </main>
  );
}
