/**
 * 饮水记录页(PRD 3.10):/water
 * 进度环 + 快捷按钮 + 今日记录列表(时间+水量)+ 自定义输入。
 * RSC 预加载今日数据;写操作后 router.refresh 同步(3.2.12)。
 */
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { serverToday } from "@/lib/date";
import { getDashboardData } from "@/lib/db/queries/dashboard";
import { listWaterLogs } from "@/lib/db/queries/water";

import { WaterPageClient } from "./water-client";

export default async function WaterPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const today = serverToday();
  const [dashboard, logs] = await Promise.all([
    getDashboardData(session.user.id, today),
    listWaterLogs(session.user.id, today),
  ]);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild aria-label="返回">
          <Link href="/diet">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">饮水记录</h1>
      </div>
      <WaterPageClient
        initialTotal={dashboard.water.currentMl}
        initialLogs={logs}
        goalMl={dashboard.water.goalMl}
      />
    </main>
  );
}
