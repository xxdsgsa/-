/**
 * 训练历史(WORKOUT-007):/workout/history
 *
 * 已完成训练按日期倒序;点入训练总结页(3.5)。
 * 历史只读(3.2.8);不经周期归属,周期删除后记录仍保留可见(3.1.4)。
 */
import { ArrowLeft, ChevronRight } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { formatDuration } from "@/lib/date";
import { listHistorySessions } from "@/lib/db/queries/training-sessions";

export default async function HistoryPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const list = await listHistorySessions(session.user.id);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      {/* 顶部:返回训练计划 */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild aria-label="返回训练计划">
          <Link href="/workout">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">训练历史</h1>
      </div>

      {list.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <p className="text-4xl">📋</p>
          <p className="text-sm text-muted-foreground">暂无训练记录,开始第一次训练吧</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {list.map((e) => (
            <Link
              key={e.sessionId}
              href={`/workout/summary?session=${e.sessionId}`}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="w-14 shrink-0">
                <p className="text-sm font-medium">{e.dayLabel}</p>
                <p className="text-xs text-muted-foreground">{e.weekday}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.trainingName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDuration(e.durationSeconds ?? 0)} · {e.completedSets} 组
                  {e.volume !== null ? ` · ${e.volume.toLocaleString("zh-CN")}kg` : ""}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
