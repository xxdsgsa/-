/**
 * 训练页(Tab 2,PRD 3.1)——周期管理 + 周列表(3.1.2)
 *
 * 守卫由 (tabs) 布局统一承担;此处保留会话判空仅为类型收窄。
 * 周期/周选择由 URL 查询参数驱动(?cycle=&week=),RSC 直出周数据;
 * 加载时先做生命周期自动流转(3.1.4),再取周期列表。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { cycleWeeks, weekIndexOf } from "@/lib/cycles";
import { serverToday } from "@/lib/date";
import { listCycles, refreshCycleStatuses } from "@/lib/db/queries/cycles";
import { getCycleWeek, type CycleWeekView } from "@/lib/db/queries/training-days";

import { CycleManager, type CycleView } from "./cycle-manager";

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  await refreshCycleStatuses(session.user.id);
  const cycles = await listCycles(session.user.id);
  const view: CycleView[] = cycles.map((c) => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
  }));

  // 选择周期:URL 指定 → 进行中 → 最新
  const sp = await searchParams;
  const requestedId = typeof sp.cycle === "string" ? sp.cycle : null;
  const selected =
    view.find((c) => c.id === requestedId) ??
    view.find((c) => c.status === "进行中") ??
    view[0] ??
    null;

  // 周选择:URL 指定(夹取)→ 默认定位(今天在区间内=今天所在周;未开始=Week1;已结束=最后一周)
  let week: CycleWeekView | null = null;
  if (selected) {
    const today = serverToday();
    const total = cycleWeeks(selected.startDate, selected.endDate);
    const reqWeek = Number.parseInt(String(sp.week ?? ""), 10);
    let defWeek = 1;
    if (today > selected.endDate) defWeek = total;
    else if (today >= selected.startDate) defWeek = weekIndexOf(today, selected.startDate);
    // 显式 week 参数越界时夹取到 [1, total],非法/缺省用默认定位
    const idx = Number.isInteger(reqWeek)
      ? Math.min(Math.max(1, reqWeek), total)
      : defWeek;
    week = await getCycleWeek(session.user.id, selected.id, idx, today);
  }

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <CycleManager cycles={view} selectedId={selected?.id ?? null} week={week} />
    </main>
  );
}
