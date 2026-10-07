/**
 * 训练总结页(PRD 3.5 / WORKOUT-010):/workout/summary?session=
 *
 * 完成训练后的成果反馈页(执行页结束后自动进入/历史列表点入)。
 * RSC 只读直出:四指标卡 + 动作完成情况;数据源 set_logs(3.5.3 只统计已完成组,
 * 无重量不折算容量);底部【返回首页】【查看训练计划】。
 */
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { formatDuration } from "@/lib/date";
import { getSessionSummary } from "@/lib/db/queries/training-sessions";

const UUID_RE = /^[0-9a-f-]{36}$/;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const sp = await searchParams;
  const sessionId = typeof sp.session === "string" ? sp.session : "";
  if (!UUID_RE.test(sessionId)) notFound();

  const view = await getSessionSummary(session.user.id, sessionId);
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      {/* 顶部:训练名 + 日期 + 完成状态标识(3.5.2) */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild aria-label="返回训练历史">
          <Link href="/workout/history">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{view.trainingName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {view.weekday} · {view.dayLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
          {view.status === "已完成" ? "✅ 已完成" : "⏱ 进行中"}
        </span>
      </div>

      {/* 本次概要:四个指标卡(3.5.2) */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatCard label="总时长" value={formatDuration(view.durationSeconds ?? 0)} />
        <StatCard label="完成动作" value={`${view.completedItems}/${view.totalItems}`} />
        <StatCard label="总组数" value={`${view.completedSets} 组`} />
        <StatCard
          label="总容量"
          value={view.volume !== null ? `${view.volume.toLocaleString("zh-CN")}kg` : "—"}
        />
      </div>

      {/* 动作完成情况列表(3.5.2:计划 vs 实际) */}
      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          <span>动作</span>
          <span>完成情况</span>
        </div>
        <div className="divide-y">
          {view.items.map((it) => {
            const full = it.completedSets >= it.plannedSets;
            return (
              <div key={it.itemId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.plannedSets} 组 × {it.reps} 次
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-medium tabular-nums ${
                    full ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {full ? "✅" : "⚠️"} {it.completedSets}/{it.plannedSets}
                </span>
              </div>
            );
          })}
          {view.items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              本次训练未编排动作
            </p>
          )}
        </div>
      </div>

      {/* 底部操作(3.5.2) */}
      <div className="mt-6 flex gap-2">
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/">返回首页</Link>
        </Button>
        <Button className="flex-1" asChild>
          <Link href={`/workout/training?training=${view.trainingId}`}>查看训练计划</Link>
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        总结只读不可编辑;截屏可分享本次成果(3.5.3)
      </p>
    </main>
  );
}
