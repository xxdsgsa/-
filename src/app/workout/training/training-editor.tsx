"use client";

/**
 * 训练编辑器(PRD 3.1.7)
 *
 * - 动作列表按追加序①②③;卡片:序号/名称/参数摘要/备注
 * - 操作:上移/下移(V1 代长按拖拽)、编辑参数、复制(同参追加)、删除(弹窗确认)
 * - 添加动作 → 动作库选择器(3.1.6) → 参数设置(3.1.7)保存加入训练
 * - 历史日期只读;保存成功 Toast"训练计划已保存"(3.1.12)并 refresh 同步
 */
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MUSCLE_GROUPS } from "@/lib/cycles";
import type { TrainingDetailView, TrainingItemView } from "@/lib/db/queries/training-items";
import type { ExerciseView } from "@/lib/db/queries/exercises";

import { ExercisePicker } from "./exercise-picker";
import { ItemParamSheet, type ParamTarget } from "./item-param-sheet";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ApiError = { success: boolean; error?: { code: string; message: string } } | null;

/** "80.0" → "80kg";"82.5" → "82.5kg" */
function formatWeight(w: string): string {
  return `${Number(Number(w).toFixed(1))}kg`;
}

/** 参数摘要:4组×12次 · 80kg · 休息90秒 */
function paramSummary(item: TrainingItemView): string {
  const parts = [`${item.sets}组×${item.reps}次`];
  if (item.targetWeight) parts.push(formatWeight(item.targetWeight));
  parts.push(`休息${item.restSeconds}秒`);
  return parts.join(" · ");
}

export function TrainingEditor({ detail }: { detail: TrainingDetailView }) {
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);
  const [name, setName] = useState(detail.name);
  const [groups, setGroups] = useState<string[]>(
    detail.muscleGroup ? detail.muscleGroup.split("+") : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paramTarget, setParamTarget] = useState<ParamTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingItemView | null>(null);
  const [busy, setBusy] = useState(false);
  // 计划锁定:历史只读 + 执行中/已完成(3.1.10 执行中不修改计划)
  const locked = detail.sessionStatus !== "none";
  const editable = !detail.readonly && !locked;
  const canStart = !detail.readonly && detail.sessionStatus === "none" && detail.date === todayStr();
  const executeHref = `/workout/execute?training=${detail.trainingId}`;

  const backHref = `/workout/day?cycle=${detail.cycleId}&date=${detail.date}`;

  async function saveInfo() {
    if (name.trim() === "" || groups.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trainings/${detail.trainingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), muscleGroups: groups, today: todayStr() }),
      });
      const body = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "保存失败,请重试");
        return;
      }
      toast.success("训练计划已保存");
      setInfoOpen(false);
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(item: TrainingItemView, direction: "up" | "down") {
    setBusy(true);
    try {
      await fetch(`/api/training-items/${item.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, today: todayStr() }),
      });
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  async function copyItem(item: TrainingItemView) {
    setBusy(true);
    try {
      const res = await fetch(`/api/trainings/${detail.trainingId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          targetWeight: item.targetWeight,
          restSeconds: item.restSeconds,
          note: item.note,
          today: todayStr(),
        }),
      });
      const body = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "复制失败,请重试");
        return;
      }
      toast.success("已复制动作");
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/training-items/${deleteTarget.id}?today=${todayStr()}`,
        { method: "DELETE" },
      );
      const body = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "删除失败,请重试");
        return;
      }
      toast.success("训练计划已保存");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  function handlePick(exercise: ExerciseView) {
    setPickerOpen(false);
    setParamTarget({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      initial: { sets: 3, reps: 10, targetWeight: "", restSeconds: 90, note: "" },
    });
  }

  function handleEditItem(item: TrainingItemView) {
    setParamTarget({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      itemId: item.id,
      initial: {
        sets: item.sets,
        reps: item.reps,
        targetWeight: item.targetWeight ?? "",
        restSeconds: item.restSeconds,
        note: item.note ?? "",
      },
    });
  }

  const lastIdx = detail.items.length - 1;

  return (
    <div>
      {/* 顶栏:返回 + 训练名(可编辑) + 部位/日期 */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="返回日编辑页"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{detail.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {detail.muscleGroup ?? "未设部位"} · {detail.dayLabel} · {detail.cycleName}
          </p>
        </div>
        {editable && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="编辑训练信息"
            onClick={() => {
              setName(detail.name);
              setGroups(detail.muscleGroup ? detail.muscleGroup.split("+") : []);
              setInfoOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>

      {detail.readonly && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          历史日期只读,不可修改计划
        </p>
      )}
      {detail.sessionStatus === "in_progress" && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2">
          <p className="text-xs font-medium text-primary">训练进行中,计划已锁定</p>
          <Button size="sm" onClick={() => router.push(executeHref)}>
            <Play className="size-4" />
            继续训练
          </Button>
        </div>
      )}
      {detail.sessionStatus === "done" && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          该训练已完成
        </p>
      )}
      {canStart && (
        <Button className="mt-4 w-full" size="lg" onClick={() => router.push(executeHref)}>
          <Play className="size-4" />
          开始训练
        </Button>
      )}

      {/* 动作列表(3.1.7:①卧推 → ②上斜卧推 → …) */}
      {detail.items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">尚未添加动作</p>
          <p className="text-sm text-muted-foreground">从动作库选择动作并设置组数次数</p>
          {editable && (
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" />
              添加动作
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {detail.items.map((item, idx) => (
            <div key={item.id} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  onClick={() => editable && handleEditItem(item)}
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {idx + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.exerciseName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {paramSummary(item)}
                    </span>
                    {item.note && (
                      <span className="block truncate text-xs text-muted-foreground">
                        备注:{item.note}
                      </span>
                    )}
                  </span>
                </button>
                {editable && (
                  <span className="flex shrink-0 items-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="上移"
                      disabled={busy || idx === 0}
                      onClick={() => moveItem(item, "up")}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="下移"
                      disabled={busy || idx === lastIdx}
                      onClick={() => moveItem(item, "down")}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="复制动作"
                      disabled={busy}
                      onClick={() => copyItem(item)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      aria-label="删除动作"
                      disabled={busy}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                )}
              </div>
            </div>
          ))}
          {editable && (
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" />
              添加动作
            </Button>
          )}
        </div>
      )}

      {/* 编辑训练信息(3.1.5:名称 + 部位多选) */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>编辑训练</SheetTitle>
            <SheetDescription>修改训练名称或部位</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="training-name">训练名称</Label>
              <Input
                id="training-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label>训练部位(多选)</Label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map((g) => {
                  const on = groups.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setGroups((prev) => (on ? prev.filter((x) => x !== g) : [...prev, g]))
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        on
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setInfoOpen(false)}>
                取消
              </Button>
              <Button
                className="flex-1"
                disabled={busy || name.trim() === "" || groups.length === 0}
                onClick={saveInfo}
              >
                {busy ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 动作库选择器(3.1.6) */}
      {editable && (
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={handlePick}
        />
      )}

      {/* 参数设置(3.1.7:添加/编辑共用) */}
      {editable && (
        <ItemParamSheet
          trainingId={detail.trainingId}
          target={paramTarget}
          onOpenChange={(open) => !open && setParamTarget(null)}
          onSaved={() => {
            setParamTarget(null);
            toast.success("训练计划已保存");
            router.refresh();
          }}
        />
      )}

      {/* 删除动作弹窗(3.1.7:确定删除该动作?) */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除该动作?</AlertDialogTitle>
            <AlertDialogDescription>
              『{deleteTarget?.exerciseName}』将从该训练中移除
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={confirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
