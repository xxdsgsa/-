"use client";

/**
 * 饮水记录交互层(PRD 3.10.2~3.10.3)
 *
 * - 进度区:当前/目标 ml + 百分比
 * - 快捷按钮:+100/+250/+500 + 自定义输入(1~2000ml)
 * - 今日记录列表:时间 + 水量,按钮删除(二次确认,3.2.16)
 * - 乐观更新:记组时先加总量,失败回滚
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { WaterLogView } from "@/lib/db/queries/water";

interface Props {
  initialTotal: number;
  initialLogs: WaterLogView[];
  goalMl: number | null;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function WaterPageClient({ initialTotal, initialLogs, goalMl }: Props) {
  const router = useRouter();
  const [total, setTotal] = useState(initialTotal);
  const [logs, setLogs] = useState(initialLogs);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WaterLogView | null>(null);

  const over = goalMl != null && total > goalMl;

  async function add(ml: number) {
    const prevTotal = total;
    setTotal((t) => t + ml);
    try {
      const res = await fetch("/api/water-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl: ml }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setTotal(prevTotal);
      toast.error("记录失败,请重试");
    }
  }

  async function submitCustom() {
    const n = Number(customMl);
    if (!Number.isInteger(n) || n < 1 || n > 2000) {
      toast.error("请输入 1~2000 之间的数值");
      return;
    }
    setSaving(true);
    const prevTotal = total;
    setTotal((t) => t + n);
    try {
      const res = await fetch("/api/water-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl: n }),
      });
      if (!res.ok) throw new Error();
      setCustomOpen(false);
      setCustomMl("");
      router.refresh();
    } catch {
      setTotal(prevTotal);
      toast.error("记录失败,请重试");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(log: WaterLogView) {
    try {
      const res = await fetch(`/api/water-logs/${log.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "删除失败");
        return;
      }
      setTotal((t) => t - log.amountMl);
      setLogs((cur) => cur.filter((x) => x.id !== log.id));
      toast.success("已删除");
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* 进度 */}
      <div className="rounded-lg border bg-card px-4 py-6 text-center">
        <p className="text-4xl font-bold tabular-nums">{total} ml</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {goalMl ? `目标 ${goalMl}ml` : "未设目标"}
          {goalMl && ` · ${Math.min(Math.round((total / goalMl) * 100), 999)}%`}
        </p>
        {over && <p className="mt-1 text-xs text-orange-500">已超过今日目标</p>}
      </div>

      {/* 快捷按钮 */}
      <div className="grid grid-cols-3 gap-2">
        {[100, 250, 500].map((ml) => (
          <Button key={ml} variant="outline" size="lg" onClick={() => void add(ml)}>
            +{ml}ml
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setCustomOpen(true)}>
          自定义
        </Button>
      </div>

      {/* 今日记录 */}
      <div>
        <p className="mb-2 text-sm font-medium">今日记录</p>
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">今天还没有记录饮水</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5"
              >
                <span className="text-sm text-muted-foreground">{fmtTime(log.createdAt)}</span>
                <span className="font-medium tabular-nums">{log.amountMl} ml</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setPendingDelete(log)}
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 自定义输入 Sheet */}
      <Sheet open={customOpen} onOpenChange={(o) => !o && setCustomOpen(false)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>记录饮水量</SheetTitle>
            <SheetDescription>请输入 1~2000 ml</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="water-custom">饮水量(ml)</Label>
              <Input
                id="water-custom"
                inputMode="numeric"
                value={customMl}
                placeholder="请输入"
                onChange={(e) => setCustomMl(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={saving} onClick={() => void submitCustom()}>
              {saving ? "保存中…" : "记录"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 删除二次确认(3.2.16) */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条饮水记录?</AlertDialogTitle>
            <AlertDialogDescription>删除后将从今日总量中扣除</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDelete && void deleteLog(pendingDelete)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
