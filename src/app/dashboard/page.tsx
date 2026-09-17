/**
 * 首页 Dashboard(PRD 3.7):五卡片总览
 * 守卫:未登录 → /login;未完成 onboarding → /onboarding(仅首次展示,3.6.9)
 * 数据:RSC 服务端渲染(UTC+8 今日口径);写操作后客户端 router.refresh 同步(3.2.12)
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { formatDateLabel, serverHour, serverToday } from "@/lib/date";
import { getDashboardData } from "@/lib/db/queries/dashboard";

import { DashboardCards } from "./cards";

export default async function DashboardPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");
  if (!session.user.onboardedAt) redirect("/onboarding");

  const today = serverToday();
  const data = await getDashboardData(session.user.id, today);

  const hour = serverHour();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-4 py-8">
      <DashboardCards
        data={data}
        today={today}
        dateLabel={formatDateLabel(today)}
        greeting={greeting}
        nickname={session.user.name || "FitMate 用户"}
      />
      <div className="mt-auto">
        <SignOutButton />
      </div>
    </main>
  );
}
