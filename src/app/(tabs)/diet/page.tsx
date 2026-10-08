/**
 * 饮食页(Tab 3,PRD 3.8 / NUTRITION-001~004)
 * RSC 直出:日视图(四餐+条目+汇总×目标)+ 饮水/补剂快捷卡数据;
 * 交互(日期切换/添加/编辑/删除)在 diet-client。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { formatDateLabel, serverToday } from "@/lib/date";
import { addDaysStr, getDietDayView } from "@/lib/db/queries/diet";
import { getSupplementCard, getWaterCard } from "@/lib/db/queries/dashboard";

import { DietClient, type DayChip } from "./diet-client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DietPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const sp = await searchParams;
  const today = serverToday();
  const dateParam = typeof sp.date === "string" ? sp.date : "";
  const date = DATE_RE.test(dateParam) ? dateParam : today;

  const [view, water, supplements] = await Promise.all([
    getDietDayView(session.user.id, date, today),
    getWaterCard(session.user.id, today),
    getSupplementCard(session.user.id, today),
  ]);

  // 日期选择器数据:今日及过去 7 天(3.8.8 补记窗口)
  const yesterday = addDaysStr(today, -1);
  const days: DayChip[] = Array.from({ length: 8 }, (_, i) => {
    const d = addDaysStr(today, i - 7);
    return { date: d, label: d === today ? "今天" : d === yesterday ? "昨天" : formatDateLabel(d) };
  });

  return <DietClient view={view} days={days} water={water} supplements={supplements} />;
}
