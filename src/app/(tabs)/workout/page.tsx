/**
 * 训练页(Tab 2,PRD 3.1)——周期管理
 * 守卫由 (tabs) 布局统一承担;此处保留会话判空仅为类型收窄。
 * 加载时先做生命周期自动流转(3.1.4),再取周期列表;
 * 周计划/动作库/训练历史在后续迭代(WORKOUT-002+)。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listCycles, refreshCycleStatuses } from "@/lib/db/queries/cycles";

import { CycleManager, type CycleView } from "./cycle-manager";

export default async function WorkoutPage() {
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

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <CycleManager cycles={view} />
    </main>
  );
}
