/**
 * 首页 Dashboard(PRD 3.7):五卡片总览
 * 守卫由 (tabs) 布局统一承担;此处保留会话判空仅为类型收窄。
 * 数据:RSC 服务端渲染(UTC+8 今日口径);写操作后客户端 router.refresh 同步(3.2.12)
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { formatDateLabel, serverHour, serverToday } from "@/lib/date";
import { getDashboardData } from "@/lib/db/queries/dashboard";

import { DashboardCards } from "./cards";

export default async function DashboardPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const today = serverToday();
  const data = await getDashboardData(session.user.id, today);

  const hour = serverHour();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-8">
      <DashboardCards
        data={data}
        today={today}
        dateLabel={formatDateLabel(today)}
        greeting={greeting}
        nickname={session.user.name || "FitMate 用户"}
      />
    </main>
  );
}
