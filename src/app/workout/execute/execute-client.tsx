"use client";

/**
 * 训练执行交互(PRD 3.1.10 / 3.2.7)
 *
 * - 四模式:ready(预览+开始) / executing(逐组记录) / done(已完成) / conflict(他训进行中)
 * - 逐组:实际重量/次数默认带入计划值,✓ 乐观标记,失败回滚不丢输入(3.1.12)
 * - 组间休息:完成一组自动倒计时(restSeconds,默认90s),±15s/跳过,到点震动+提示
 * - 跳过动作:剩余组记"未完成";动作全部✓自动折叠进入下一动作
 * - 结束:全部完成自动结束;提前结束弹窗确认(3.2.7);总时长自 startedAt 起算(中断恢复计时继续)
 * - 中断恢复:直接续(会话/逐组记录服务端持久化,重新进入即恢复)
 */
import { ArrowLeft, Check, Flag, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import type { ExecutionView, ExecutingItemView } from "@/lib/db/queries/training-sessions";

const WEIGHT_RE = /^\d{1,4}(\.\d)?$/;

type ApiError = { success: boolean; error?: { code: string; message: string } } | null;

interface LocalSet {
  setIndex: number;
  weight: string;
  reps: string;
  state: "todo" | "done" | "skipped";
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 本地逐组状态:完成行带实际值;未做行带入计划值(3.1.10) */
function initLogs(items: ExecutingItemView[]): Record<string, LocalSet[]> {
  const map: Record<string, LocalSet[]> = {};
  for (const item of items) {
    const logs = new Map(item.logs.map((l) => [l.setIndex, l]));
    map[item.itemId] = Array.from({ length: item.sets }, (_, i) => {
      const log = logs.get(i + 1);
      if (!log) {
        return {
          setIndex: i + 1,
          weight: item.targetWeight ?? "",
          reps: String(item.reps),
          state: "todo" as const,
        };
      }
      return log.completed
        ? {
            setIndex: i + 1,
            weight: log.weight ?? "",
            reps: log.reps === null ? "" : String(log.reps),
            state: "done" as const,
          }
        : { setIndex: i + 1, weight: "", reps: "", state: "skipped" as const };
    });
  }
  return map;
}

/** 第一个仍有未完成组的动作索引(全完成 → -1) */
function firstActiveIdx(items: ExecutingItemView[], logs: Record<string, LocalSet[]>): number {
  for (let i = 0; i < items.length; i++) {
    if ((logs[items[i].itemId] ?? []).some((s) => s.state === "todo")) return i;
  }
  return -1;
}

export function ExecuteClient({ view }: { view: ExecutionView }) {
  const router = useRouter();
  const [logs, setLogs] = useState<Record<string, LocalSet[]>>(() => initLogs(view.items));
  const [currentIdx, setCurrentIdx] = useState(() =>
    view.mode === "executing" ? firstActiveIdx(view.items, initLogs(view.items)) : -1,
  );
  const [rest, setRest] = useState<{ remaining: number } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  if (view.mode === "executing" && view.session) {
    startedAtRef.current = new Date(view.session.startedAt).getTime();
  }

  // 总时长计时(自 startedAt 起算;恢复后继续)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (view.mode !== "executing") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [view.mode]);
  const elapsedSec =
    startedAtRef.current !== null
      ? Math.max(0, Math.floor((now - startedAtRef.current) / 1000))
      : 0;

  // 组间休息倒计时:到点震动+提示(3.1.10)
  useEffect(() => {
    if (!rest) return;
    const t = setTimeout(() => {
      if (rest.remaining <= 1) {
        navigator.vibrate?.([200, 100, 200]);
        toast.success("休息结束,开始下一组!");
        setRest(null);
      } else {
        setRest({ remaining: rest.remaining - 1 });
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const backHref = `/workout/day?cycle=${view.cycleId}&date=${view.date}`;

  async function post(path: string, body: unknown): Promise<ApiError> {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !parsed?.success) return parsed ?? { success: false };
      return null;
    } catch {
      return { success: false, error: { code: "NETWORK", message: "网络异常,请检查网络后重试" } };
    }
  }

  /* ---------- ready:开始训练 ---------- */
  async function handleStart() {
    if (busy) return;
    setBusy(true);
    const err = await post(`/api/trainings/${view.trainingId}/start`, { today: todayStr() });
    setBusy(false);
    if (err) {
      toast.error(err.error?.message ?? "开始失败,请重试");
      return;
    }
    router.refresh();
  }

  /* ---------- executing:完成一组(乐观) ---------- */
  async function completeSet(item: ExecutingItemView, setIdx: number) {
    if (!view.session || busy) return;
    const local = logs[item.itemId][setIdx - 1];
    if (local.state !== "todo") return;
    if (local.weight !== "" && !WEIGHT_RE.test(local.weight)) {
      toast.error("实际重量不合法,最多 1 位小数");
      return;
    }
    const repsVal = local.reps === "" ? null : Number(local.reps);
    if (repsVal !== null && (!Number.isInteger(repsVal) || repsVal < 1)) {
      toast.error("实际次数必须为不小于 1 的整数");
      return;
    }

    // 乐观标记
    setLogs((prev) => ({
      ...prev,
      [item.itemId]: prev[item.itemId].map((s) =>
        s.setIndex === setIdx ? { ...s, state: "done" as const } : s,
      ),
    }));

    const err = await post(`/api/sessions/${view.session.id}/sets`, {
      trainingItemId: item.itemId,
      setIndex: setIdx,
      weight: local.weight === "" ? null : local.weight,
      reps: repsVal,
    });
    if (err) {
      // 失败回滚,输入保留(3.1.12)
      setLogs((prev) => ({
        ...prev,
        [item.itemId]: prev[item.itemId].map((s) =>
          s.setIndex === setIdx ? { ...s, state: "todo" as const } : s,
        ),
      }));
      toast.error(err.error?.message ?? "保存失败,请重试");
      return;
    }

    advance(item, setIdx);
  }

  /** 组完成后推进:休息倒计时 / 折叠进下一动作 / 全部完成自动结束 */
  function advance(item: ExecutingItemView, setIdx: number) {
    const remaining = logs[item.itemId].filter((s) => s.state === "todo" && s.setIndex !== setIdx);
    if (remaining.length > 0) {
      if (item.restSeconds > 0) setRest({ remaining: item.restSeconds });
      return;
    }
    const next = view.items.findIndex(
      (it) => it.itemId !== item.itemId && (logs[it.itemId] ?? []).some((s) => s.state === "todo"),
    );
    if (next >= 0) {
      setCurrentIdx(next);
      return;
    }
    setCurrentIdx(-1);
    void autoFinish();
  }

  /* ---------- executing:跳过动作 ---------- */
  async function skipCurrent(item: ExecutingItemView) {
    if (!view.session || busy) return;
    setBusy(true);
    const err = await post(`/api/sessions/${view.session.id}/skip-item`, {
      trainingItemId: item.itemId,
    });
    setBusy(false);
    if (err) {
      toast.error(err.error?.message ?? "操作失败,请重试");
      return;
    }
    setLogs((prev) => ({
      ...prev,
      [item.itemId]: prev[item.itemId].map((s) =>
        s.state === "todo" ? { ...s, state: "skipped" as const } : s,
      ),
    }));
    const next = view.items.findIndex(
      (it) => it.itemId !== item.itemId && (logs[it.itemId] ?? []).some((s) => s.state === "todo"),
    );
    if (next >= 0) {
      setCurrentIdx(next);
      return;
    }
    setCurrentIdx(-1);
    void autoFinish();
  }

  /* ---------- 结束训练(全部完成/提前结束统一入口,3.2.7) ---------- */
  async function autoFinish() {
    if (!view.session) return;
    const err = await post(`/api/sessions/${view.session.id}/finish`, {});
    if (err) {
      toast.error(err.error?.message ?? "结束失败,请重试");
      return;
    }
    toast.success("训练完成!");
    // 自动进入训练总结页(3.1.10/3.2.7);replace 使返回键不回到执行态
    router.replace(`/workout/summary?session=${view.session.id}`);
  }

  const hasIncomplete = view.items.some((it) =>
    (logs[it.itemId] ?? []).some((s) => s.state === "todo"),
  );

  async function handleFinishButton() {
    if (hasIncomplete) {
      setConfirmFinish(true);
      return;
    }
    await autoFinish();
  }

  /* ---------- 非执行态 ---------- */
  if (view.mode === "ready") {
    return (
      <div>
        <Header view={view} elapsed={null} onExit={() => router.push(backHref)} exitLabel="返回" />
        <p className="mt-4 text-sm text-muted-foreground">
          {view.dayLabel} · {view.muscleGroup ?? "未设部位"} · 共 {view.items.length} 个动作
        </p>
        <div className="mt-3 space-y-2">
          {view.items.map((it) => (
            <div key={it.itemId} className="rounded-lg border bg-card px-4 py-3">
              <p className="font-medium">{it.exerciseName}</p>
              <p className="text-xs text-muted-foreground">
                {it.sets}组×{it.reps}次{it.targetWeight ? ` · ${Number(it.targetWeight)}kg` : ""} · 休息{it.restSeconds}秒
              </p>
            </div>
          ))}
          {view.items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              该训练尚未编排动作,请先在计划中添加
            </p>
          )}
        </div>
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={busy || view.items.length === 0}
          onClick={handleStart}
        >
          <Play className="size-4" />
          {busy ? "开始中…" : "开始训练"}
        </Button>
      </div>
    );
  }

  if (view.mode === "conflict") {
    return (
      <div>
        <Header view={view} elapsed={null} onExit={() => router.push(backHref)} exitLabel="返回" />
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="font-medium">『{view.conflict?.trainingName}』训练进行中</p>
          <p className="text-sm text-muted-foreground">
            每次只能进行一个训练,请先继续或结束它
          </p>
          <Button onClick={() => router.push(`/workout/execute?training=${view.conflict?.trainingId}`)}>
            前往继续
          </Button>
        </div>
      </div>
    );
  }

  if (view.mode === "done") {
    return (
      <div>
        <Header view={view} elapsed={null} onExit={() => router.push(backHref)} exitLabel="返回" />
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="text-3xl">✅</span>
          <p className="font-medium">该训练已完成</p>
          {view.doneSessionId && (
            <Button onClick={() => router.push(`/workout/summary?session=${view.doneSessionId}`)}>
              查看总结
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push(backHref)}>
            返回训练日
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- executing ---------- */
  return (
    <div className="pb-24">
      <Header
        view={view}
        elapsed={fmtClock(elapsedSec)}
        onExit={handleFinishButton}
        exitLabel="结束训练"
      />

      <div className="mt-4 space-y-2">
        {view.items.map((item, idx) => {
          const local = logs[item.itemId] ?? [];
          const doneCount = local.filter((s) => s.state === "done").length;
          const skipped = local.some((s) => s.state === "skipped") && doneCount === 0;
          const isCurrent = idx === currentIdx;
          const allDone = local.length > 0 && local.every((s) => s.state !== "todo");

          if (!isCurrent) {
            return (
              <div
                key={item.itemId}
                className={`flex items-center gap-2 rounded-lg border bg-card px-4 py-3 ${
                  allDone ? "" : "opacity-60"
                }`}
              >
                <span className="text-sm">{allDone ? (skipped ? "⏭️" : "✅") : "○"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.exerciseName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {allDone ? (skipped ? "已跳过" : `${doneCount}/${local.length} 组完成`) : `${local.length} 组`}
                  </span>
                </span>
              </div>
            );
          }

          return (
            <div key={item.itemId} className="rounded-lg border-2 border-primary bg-card px-4 py-3">
              <p className="font-medium">{item.exerciseName}</p>
              <p className="text-xs text-muted-foreground">
                目标:{item.sets}组×{item.reps}次{item.targetWeight ? ` · ${Number(item.targetWeight)}kg` : ""}
                {" · 休息"}{item.restSeconds}秒
              </p>
              {item.note && <p className="text-xs text-muted-foreground">备注:{item.note}</p>}

              <div className="mt-3 space-y-2">
                {local.map((s) => {
                  if (s.state === "done") {
                    return (
                      <div
                        key={s.setIndex}
                        className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                      >
                        <span>第 {s.setIndex} 组</span>
                        <span className="text-muted-foreground">
                          {s.weight ? `${Number(s.weight)}kg` : "—"} × {s.reps || "—"}
                        </span>
                        <Check className="size-4 text-primary" />
                      </div>
                    );
                  }
                  if (s.state === "skipped") {
                    return (
                      <div
                        key={s.setIndex}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                      >
                        <span>第 {s.setIndex} 组</span>
                        <span>跳过</span>
                      </div>
                    );
                  }
                  return (
                    <div key={s.setIndex} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-sm text-muted-foreground">
                        第 {s.setIndex} 组
                      </span>
                      <Input
                        aria-label={`第${s.setIndex}组实际重量`}
                        className="h-9 w-20"
                        inputMode="decimal"
                        placeholder="重量"
                        value={s.weight}
                        onChange={(e) =>
                          setLogs((prev) => ({
                            ...prev,
                            [item.itemId]: prev[item.itemId].map((x) =>
                              x.setIndex === s.setIndex ? { ...x, weight: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <Input
                        aria-label={`第${s.setIndex}组实际次数`}
                        className="h-9 w-16"
                        inputMode="numeric"
                        placeholder="次数"
                        value={s.reps}
                        onChange={(e) =>
                          setLogs((prev) => ({
                            ...prev,
                            [item.itemId]: prev[item.itemId].map((x) =>
                              x.setIndex === s.setIndex ? { ...x, reps: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={busy}
                        onClick={() => completeSet(item, s.setIndex)}
                      >
                        ✓ 完成
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                className="mt-3 w-full text-muted-foreground"
                disabled={busy}
                onClick={() => skipCurrent(item)}
              >
                <Flag className="size-4" />
                跳过此动作
              </Button>
            </div>
          );
        })}
      </div>

      {/* 组间休息浮层:倒计时 + ±15s + 跳过(3.1.10) */}
      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-sm rounded-t-2xl border-t bg-background p-5 shadow-lg">
          <p className="text-center text-xs text-muted-foreground">组间休息</p>
          <p className="text-center text-4xl font-bold tabular-nums">{fmtClock(rest.remaining)}</p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setRest({ remaining: Math.max(15, rest.remaining - 15) })}
            >
              −15s
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setRest({ remaining: rest.remaining + 15 })}
            >
              +15s
            </Button>
            <Button className="flex-1" onClick={() => setRest(null)}>
              跳过休息
            </Button>
          </div>
        </div>
      )}

      {/* 提前结束确认(3.2.7) */}
      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>训练尚未全部完成</AlertDialogTitle>
            <AlertDialogDescription>
              确认结束?已完成内容将保存,未完成动作记&ldquo;未完成&rdquo;
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续训练</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmFinish(false);
                void autoFinish();
              }}
            >
              结束训练
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 顶栏:返回 + 训练名 + 总时长 + 结束按钮 */
function Header({
  view,
  elapsed,
  onExit,
  exitLabel,
}: {
  view: ExecutionView;
  elapsed: string | null;
  onExit: () => void;
  exitLabel: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="ghost" aria-label="返回" onClick={() => router.back()}>
        <ArrowLeft className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold leading-tight">{view.name}</p>
        <p className="truncate text-xs text-muted-foreground">{view.dayLabel}</p>
      </div>
      {elapsed !== null && (
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums">
          {elapsed}
        </span>
      )}
      <Button
        size="sm"
        variant={exitLabel === "结束训练" ? "destructive" : "ghost"}
        onClick={onExit}
      >
        {exitLabel}
      </Button>
    </div>
  );
}
