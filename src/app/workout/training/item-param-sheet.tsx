"use client";

/**
 * 动作参数设置(PRD 3.1.7)
 *
 * 字段:组数*(≥1) / 次数*(≥1) / 目标重量(可选,≥0) / 休息时间(可选,秒) / 备注(可选)。
 * 添加(动作库选择后)与编辑(动作卡片)共用;保存后动作加入/更新到训练。
 */
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface ParamValues {
  sets: number;
  reps: number;
  targetWeight: string;
  restSeconds: number;
  note: string;
}

export interface ParamTarget {
  exerciseId: string;
  exerciseName: string;
  /** 有值 = 编辑已有动作项 */
  itemId?: string;
  initial: ParamValues;
}

type ApiError = { success: boolean; error?: { code: string; message: string } } | null;

const WEIGHT_RE = /^\d{1,4}(\.\d)?$/;

interface Props {
  trainingId: string;
  target: ParamTarget | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ItemParamSheet({ trainingId, target, onOpenChange, onSaved }: Props) {
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");
  const [rest, setRest] = useState("90");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // target 变化时以传入值初始化(编辑带原参数)
  const [lastTarget, setLastTarget] = useState<ParamTarget | null>(null);
  if (target !== lastTarget) {
    setLastTarget(target);
    if (target) {
      setSets(String(target.initial.sets));
      setReps(String(target.initial.reps));
      setWeight(target.initial.targetWeight);
      setRest(String(target.initial.restSeconds));
      setNote(target.initial.note);
    }
  }

  function validate(): { sets: number; reps: number; rest: number } | null {
    const s = Number(sets);
    const r = Number(reps);
    const restS = Number(rest);
    if (!Number.isInteger(s) || s < 1) {
      toast.error("组数必须为不小于 1 的整数");
      return null;
    }
    if (!Number.isInteger(r) || r < 1) {
      toast.error("次数必须为不小于 1 的整数");
      return null;
    }
    if (!Number.isInteger(restS) || restS < 0 || restS > 3600) {
      toast.error("休息时间需在 0~3600 秒之间");
      return null;
    }
    if (weight !== "" && !WEIGHT_RE.test(weight)) {
      toast.error("目标重量不能小于 0,最多 1 位小数");
      return null;
    }
    return { sets: s, reps: r, rest: restS };
  }

  async function handleSubmit() {
    if (!target || submitting) return;
    const v = validate();
    if (!v) return;
    setSubmitting(true);
    try {
      const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      const isEdit = target.itemId !== undefined;
      const res = await fetch(
        isEdit ? `/api/training-items/${target.itemId}` : `/api/trainings/${trainingId}/items`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isEdit ? {} : { exerciseId: target.exerciseId }),
            sets: v.sets,
            reps: v.reps,
            targetWeight: weight === "" ? null : weight,
            restSeconds: v.rest,
            note: note.trim() === "" ? null : note.trim(),
            today,
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as ApiError;
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "保存失败,请重试");
        return;
      }
      onSaved();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{target?.itemId ? "编辑动作" : target?.exerciseName}</SheetTitle>
          <SheetDescription>
            {target?.itemId ? target.exerciseName : "设置组数与次数,保存后加入训练"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="param-sets">组数</Label>
              <Input
                id="param-sets"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="param-reps">次数</Label>
              <Input
                id="param-reps"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="param-weight">目标重量(可选)</Label>
              <Input
                id="param-weight"
                type="text"
                inputMode="decimal"
                placeholder="如:80"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="param-rest">休息时间(秒)</Label>
              <Input
                id="param-rest"
                type="number"
                inputMode="numeric"
                min={0}
                max={3600}
                value={rest}
                onChange={(e) => setRest(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="param-note">备注(可选)</Label>
            <Input
              id="param-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button className="flex-1" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
