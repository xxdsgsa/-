"use client";

/**
 * 日编辑器(PRD 3.1.5)
 *
 * - 空态:今天暂无训练 /【添加训练】【设为休息日】
 * - 一天多训练:卡片列表按添加顺序,重复"添加训练"为追加
 * - 添加训练:名称 + 部位多选(胸/背/肩/二头/三头/腿/核心);操作:保存 / 下一步(→动作编排)
 * - 点击训练卡进入训练编辑页(动作编排,3.1.6/3.1.7)
 * - 休息日:设(有训练时二次确认后移除计划)/取消;历史日期只读
 * - 保存成功 Toast"训练计划已保存"(3.1.12),立即 router.refresh 同步
 */
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { MUSCLE_GROUPS } from "@/lib/cycles";
import type { DayDetailView, DayTrainingView } from "@/lib/db/queries/training-days";

/** 客户端"今日"(设备时区日历日,ADR-12):YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ApiError = { success: boolean; error?: { code: string; message: string } } | null;
type CreateResult = {
  success: boolean;
  data?: { training: { id: string } };
  error?: { code: string; message: string };
} | null;

export function DayEditor({ detail }: { detail: DayDetailView }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  const formValid = name.trim() !== "" && groups.length > 0;
  const editable = !detail.readonly;

  function openAdd() {
    setName("");
    setGroups([]);
    setFormOpen(true);
  }

  /** 3.1.5 操作:保存(留在日页) / 下一步(进动作编排,3.1.6) */
  async function handleSubmit(goNext: boolean) {
    if (!formValid || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/days/${detail.date}/trainings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          muscleGroups: groups,
          today: todayStr(),
          cycleId: detail.cycleId,
        }),
      });
      const body = (await res.json().catch(() => null)) as CreateResult;
      if (!res.ok || !body?.success || !body.data) {
        toast.error(body?.error?.message ?? "保存失败,请重试");
        return;
      }
      toast.success("训练计划已保存");
      setFormOpen(false);
      if (goNext) {
        router.push(`/workout/training?training=${body.data.training.id}`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(training: DayTrainingView) {
    if (!window.confirm(`确定删除训练『${training.name}』吗?`)) return; // TODO(ui): 换 AlertDialog
    setBusy(true);
    try {
      const res = await fetch(`/api/trainings/${training.id}?today=${todayStr()}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "删除失败,请重试");
        return;
      }
      toast.success("训练计划已保存");
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetRest(isRest: boolean) {
    if (isRest && detail.trainings.length > 0) {
      const ok = window.confirm(
        `设为休息日将移除当天 ${detail.trainings.length} 个计划训练,历史训练记录不受影响,确定吗?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/days/${detail.date}/set-rest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: detail.cycleId, isRest, today: todayStr() }),
      });
      const body = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "操作失败,请重试");
        return;
      }
      toast.success(isRest ? "已设为休息日" : "已取消休息日");
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* 顶栏:返回 + 周信息(3.1.5) */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="返回训练计划"
          onClick={() => router.push(`/workout?cycle=${detail.cycleId}`)}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <p className="text-lg font-bold leading-tight">
            Week {detail.weekIndex} · {detail.weekday}
          </p>
          <p className="text-xs text-muted-foreground">
            {detail.dayLabel} · {detail.cycleName}
          </p>
        </div>
      </div>

      {detail.readonly && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          历史日期只读,不可修改计划
        </p>
      )}

      {detail.isRest ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-4xl">💤</p>
          <p className="font-medium">{detail.dayLabel}是休息日</p>
          {editable && (
            <Button variant="outline" disabled={busy} onClick={() => handleSetRest(false)}>
              取消休息日
            </Button>
          )}
        </div>
      ) : detail.trainings.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">今天暂无训练</p>
          {editable ? (
            <div className="flex gap-2">
              <Button onClick={openAdd}>
                <Plus className="size-4" />
                添加训练
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => handleSetRest(true)}>
                设为休息日
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">未安排训练</p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {detail.trainings.map((training) => (
            <div
              key={training.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  router.push(`/workout/training?training=${training.id}`)
                }
              >
                <span className="block truncate font-medium">{training.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {training.muscleGroup ?? "未设部位"} ·{" "}
                  {training.itemCount > 0
                    ? `${training.itemCount} 个动作`
                    : "未添加动作,点击编排"}
                </span>
              </button>
              {editable && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  aria-label="删除训练"
                  disabled={busy}
                  onClick={() => handleDelete(training)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {editable && (
            <Button variant="outline" className="w-full" onClick={openAdd}>
              <Plus className="size-4" />
              添加训练
            </Button>
          )}
        </div>
      )}

      {/* 添加训练(3.1.5:名称 + 部位多选;操作:保存 / 下一步→动作编排) */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>添加训练</SheetTitle>
            <SheetDescription>
              同一天可添加多个训练,按添加顺序排列
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="training-name">训练名称</Label>
              <Input
                id="training-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如:Push Day"
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
              <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleSubmit(false)}
                disabled={!formValid || submitting}
              >
                {submitting ? "保存中…" : "保存"}
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSubmit(true)}
                disabled={!formValid || submitting}
              >
                {submitting ? "保存中…" : "下一步"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
