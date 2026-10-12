/**
 * 数据页(Tab 4,PRD 3.11):今日/周/月统计 + 体重趋势
 *
 * 单页滚动分区(3.11.2):今日 → 周 → 月 → 体重
 * RSC 直出,无客户端交互(V1.0 不做图表,V1.1 再加)。
 * 今日段复用 DashboardData(3.11.3 规定与首页卡片同源只读)。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { formatDateLabel, serverToday } from "@/lib/date";
import { getDashboardData } from "@/lib/db/queries/dashboard";
import { getMonthStats, getWeekStats, listWeightRecent, getWeightTrend } from "@/lib/db/queries/stats";

function pct(cur: number, goal: number | null): number | null {
  if (goal == null || goal <= 0) return null;
  return Math.min(Math.round((cur / goal) * 100), 100);
}

function fmtDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}kg`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 mb-2 text-sm font-semibold text-muted-foreground">{children}</h2>;
}

export default async function StatsPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const today = serverToday();
  const [todayData, week, month, weightTrend, weightList] = await Promise.all([
    getDashboardData(session.user.id, today),
    getWeekStats(session.user.id, today),
    getMonthStats(session.user.id, today),
    getWeightTrend(session.user.id, "30d", today),
    listWeightRecent(session.user.id, 10),
  ]);

  const kcalPct = pct(todayData.nutrition.kcal.current, todayData.nutrition.kcal.goal);
  const waterPct = pct(todayData.water.currentMl, todayData.water.goalMl);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <h1 className="text-xl font-bold">数据</h1>

      {/* 3.11.3 今日数据 */}
      <SectionTitle>今日 · {formatDateLabel(today)}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="训练"
          value={
            todayData.training.state === "completed"
              ? "✅ 已完成"
              : todayData.training.state === "in_progress"
                ? "⏱ 进行中"
                : todayData.training.state === "not_started"
                  ? "○ 未开始"
                  : todayData.training.state === "missed"
                    ? "❌ 未完成"
                    : todayData.training.state === "rest"
                      ? "💤 休息日"
                      : "—"
          }
          sub={todayData.training.title}
        />
        <StatTile
          label="营养"
          value={`${todayData.nutrition.kcal.current}kcal`}
          sub={kcalPct !== null ? `${kcalPct}% · 目标 ${todayData.nutrition.kcal.goal}` : "未设目标"}
        />
        <StatTile
          label="饮水"
          value={`${todayData.water.currentMl}ml`}
          sub={waterPct !== null ? `${waterPct}% · 目标 ${todayData.water.goalMl}ml` : "未设目标"}
        />
        <StatTile
          label="补剂"
          value={`${todayData.supplements.todayCount} 次`}
          sub={
            todayData.supplements.targetCount > 0
              ? `目标 ${todayData.supplements.targetCount} 次`
              : "无目标"
          }
        />
      </div>

      {/* 3.11.4 周统计 */}
      <SectionTitle>
        本周 · {formatDateLabel(week.rangeStart)} ~ {formatDateLabel(week.rangeEnd)}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="训练"
          value={`${week.training.completedDays}/${week.training.completedDays + week.training.notDoneDays} 天`}
          sub={
            week.training.rate !== null
              ? `完成率 ${week.training.rate}%`
              : "本周无训练"
          }
        />
        <StatTile
          label="体重"
          value={
            week.weight.end
              ? `${week.weight.end.weightKg.toFixed(1)}kg`
              : "—"
          }
          sub={
            week.weight.start && week.weight.end
              ? `周初 ${week.weight.start.weightKg.toFixed(1)}kg · ${fmtDelta(week.weight.deltaKg)}`
              : "本周无记录"
          }
        />
        <StatTile
          label="日均热量"
          value={week.nutrition.avgKcal !== null ? `${week.nutrition.avgKcal}kcal` : "—"}
          sub={
            week.nutrition.recordedDays > 0
              ? `基于 ${week.nutrition.recordedDays} 天记录`
              : "无饮食记录"
          }
        />
        <StatTile
          label="日均蛋白"
          value={week.nutrition.avgProteinG !== null ? `${week.nutrition.avgProteinG}g` : "—"}
          sub={week.nutrition.recordedDays > 0 ? `基于 ${week.nutrition.recordedDays} 天` : ""}
        />
      </div>

      {/* 3.11.5 月统计 */}
      <SectionTitle>
        本月 · {formatDateLabel(month.rangeStart)} ~ {formatDateLabel(month.rangeEnd)}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="训练"
          value={`${month.training.completedDays}/${month.training.completedDays + month.training.notDoneDays} 天`}
          sub={
            month.training.rate !== null
              ? `完成率 ${month.training.rate}%`
              : "本月无训练"
          }
        />
        <StatTile
          label="体重"
          value={
            month.weight.end
              ? `${month.weight.end.weightKg.toFixed(1)}kg`
              : "—"
          }
          sub={
            month.weight.start && month.weight.end
              ? `月初 ${month.weight.start.weightKg.toFixed(1)}kg · ${fmtDelta(month.weight.deltaKg)}`
              : "本月无记录"
          }
        />
        <StatTile
          label="日均热量"
          value={month.nutrition.avgKcal !== null ? `${month.nutrition.avgKcal}kcal` : "—"}
          sub={
            month.nutrition.recordedDays > 0
              ? `基于 ${month.nutrition.recordedDays} 天记录`
              : "无饮食记录"
          }
        />
        <StatTile
          label="日均蛋白"
          value={month.nutrition.avgProteinG !== null ? `${month.nutrition.avgProteinG}g` : "—"}
          sub={month.nutrition.recordedDays > 0 ? `基于 ${month.nutrition.recordedDays} 天` : ""}
        />
      </div>

      {/* 3.11.7 体重记录与趋势 */}
      <SectionTitle>体重</SectionTitle>
      <div className="rounded-lg border bg-card px-4 py-3">
        {weightTrend.latest ? (
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold tabular-nums">
              {weightTrend.latest.weightKg.toFixed(1)}kg
            </p>
            {weightTrend.deltaKg !== null && (
              <p
                className={`text-sm tabular-nums ${
                  weightTrend.deltaKg > 0
                    ? "text-rose-600"
                    : weightTrend.deltaKg < 0
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                }`}
              >
                {fmtDelta(weightTrend.deltaKg)}
              </p>
            )}
            <p className="ml-auto text-xs text-muted-foreground">
              {formatDateLabel(weightTrend.latest.date)} · 近 30 天
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无体重记录</p>
        )}
        {/* 折线图占位: V1.1 接入(3.11.10 评审 2) */}
        {weightTrend.points.length > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {weightTrend.points.length} 个数据点 · 详细图表 V1.1 接入
          </p>
        )}
      </div>

      {weightList.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-lg border bg-card">
          <div className="border-b bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
            最近 {weightList.length} 条
          </div>
          <div className="divide-y">
            {weightList.map((w, i) => {
              const prev = weightList[i + 1];
              const delta = prev ? w.weightKg - prev.weightKg : null;
              return (
                <div key={w.date} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{formatDateLabel(w.date)}</span>
                  <span className="tabular-nums">
                    {w.weightKg.toFixed(1)}kg
                    {delta !== null && (
                      <span
                        className={`ml-2 text-xs ${
                          delta > 0
                            ? "text-rose-600"
                            : delta < 0
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {fmtDelta(delta)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          暂无体重记录,到首页【记录】添加
        </p>
      )}

      {/* 训练日历(3.11.6 P2 后置) */}
      <SectionTitle>训练日历(计划中)</SectionTitle>
      <p className="text-sm text-muted-foreground">月历视图 V1.x 接入</p>
    </main>
  );
}
