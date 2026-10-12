"use client";

/**
 * 补剂管理交互层(PRD 3.9.2)
 *
 * - 列表:名称 + 单位/单次剂量 + 每日目标 + 今日打卡次数
 * - 编辑/删除:列表行操作(删除二次确认,3.2.16)
 * - 今日打卡:列表行展开查看 + 单条左滑删除(3.9.3)
 *
 * RSC 直出初始数据;写操作后 router.refresh 同步(3.2.12)。
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type {
  SupplementLogView,
  SupplementView,
} from "@/lib/db/queries/supplements";
import { SUPPLEMENT_UNIT_LABELS } from "@/lib/db/queries/supplements";

interface Props {
  initialList: SupplementView[];
  todayCount: number;
}

function fmtDose(dose: string, unit: SupplementView["unit"]): string {
  return `${Number(dose)} ${SUPPLEMENT_UNIT_LABELS[unit]}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SupplementManager({ initialList, todayCount }: Props) {
  const router = useRouter();
  const [list] = useState(initialList);
  const [logs, setLogs] = useState<SupplementLogView[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SupplementView | null>(null);
  const [pendingDeleteLog, setPendingDeleteLog] = useState<SupplementLogView | null>(null);

  async function loadLogs() {
    if (logs) {
      setExpanded((e) => !e);
      return;
    }
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/supplement-logs", { method: "GET" });
      if (!res.ok) {
        toast.error("加载打卡记录失败");
        return;
      }
      const body = (await res.json()) as { data: { logs: SupplementLogView[] } };
      setLogs(body.data.logs);
      setExpanded(true);
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setLoadingLogs(false);
    }
  }

  async function deleteSupplement(s: SupplementView) {
    try {
      const res = await fetch(`/api/supplements/${s.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "删除失败");
        return;
      }
      toast.success("已删除");
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setPendingDelete(null);
    }
  }

  async function deleteLog(l: SupplementLogView) {
    try {
      const res = await fetch(`/api/supplement-logs/${l.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "删除失败");
        return;
      }
      toast.success("已删除");
      setLogs((cur) => (cur ? cur.filter((x) => x.id !== l.id) : cur));
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setPendingDeleteLog(null);
    }
  }

  if (list.length === 0) {
    return (
      <div className="mt-20 flex flex-col items-center gap-3 text-center">
        <p className="text-4xl">💊</p>
        <p className="text-sm text-muted-foreground">
          还没有补剂
          <br />
          点击右上【添加】创建第一个补剂
        </p>
      </div>
    );
  }

  const totalTarget = list.reduce((n, s) => n + (s.dailyTarget ?? 0), 0);
  const reached = totalTarget > 0 && todayCount >= totalTarget;

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-sm font-medium">今日打卡</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">
          {todayCount}
          {totalTarget > 0 && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ {totalTarget} 次</span>
          )}
        </p>
        {reached && <p className="mt-1 text-xs text-emerald-600">目标达成 ✓</p>}
      </div>

      {list.map((s) => (
        <div key={s.id} className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDose(s.dose, s.unit)} / 次
                {s.dailyTarget ? ` · 每日 ${s.dailyTarget} 次` : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/supplements/${s.id}/edit`)}
            >
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setPendingDelete(s)}
            >
              删除
            </Button>
          </div>
        </div>
      ))}

      <div>
        <Button
          variant="outline"
          className="w-full"
          onClick={loadLogs}
          disabled={loadingLogs}
        >
          {loadingLogs
            ? "加载中…"
            : expanded
              ? "收起今日打卡记录"
              : "查看今日打卡记录"}
        </Button>
        {expanded && logs && (
          <div className="mt-2 space-y-1">
            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                今天还没有打卡
              </p>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                >
                  <div>
                    <p className="text-sm">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtTime(l.loggedAt)} · {Number(l.dose)} {SUPPLEMENT_UNIT_LABELS[l.unit]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setPendingDeleteLog(l)}
                  >
                    删除
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 删除补剂二次确认(3.2.16) */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除补剂『{pendingDelete?.name}』?</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将不再出现在打卡列表,历史记录保留
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDelete && void deleteSupplement(pendingDelete)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除打卡记录二次确认(3.2.16) */}
      <AlertDialog
        open={!!pendingDeleteLog}
        onOpenChange={(o) => !o && setPendingDeleteLog(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条打卡?</AlertDialogTitle>
            <AlertDialogDescription>删除后该条记录不再计入今日次数</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDeleteLog && void deleteLog(pendingDeleteLog)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
