"use client";

/**
 * Onboarding 4 步向导(PRD 3.6.6)
 *
 * - 顶部进度指示,可返回上一步
 * - 最后一步【完成设置】才落库
 * - 草稿自动保存(2s 防抖,localStorage 白名单项,ADR-15;恢复/放弃弹窗见 3.3.3)
 * - 步骤 3 目标由 calcNutritionGoals 实时计算,手动调整项标记并优先
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcNutritionGoals, GOAL_TYPE_LABEL, type Gender, type GoalType } from "@/lib/nutrition";

const DRAFT_KEY = "fitmate.onboarding.draft";

const STEP_TITLES = ["基础信息", "健身目标", "营养目标", "首个训练周期"];

interface Draft {
  step: number;
  gender?: Gender;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  goalType?: GoalType;
  targetWeightKg?: number;
  targetDate?: string;
  weeklyTrainingDays?: number;
  manualGoals: Partial<Record<"calories" | "protein" | "carbs" | "fat" | "waterMl", number>>;
  cycleName?: string;
  cycleStart?: string;
  cycleEnd?: string;
  skipCycle?: boolean;
  savedAt?: number;
}

const EMPTY_DRAFT: Draft = { step: 1, manualGoals: {} };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function NumField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  unit,
  optional,
  placeholder,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min: number;
  max: number;
  unit?: string;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1 text-xs text-muted-foreground">(选填)</span>}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          placeholder={placeholder ?? `${min}~${max}`}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
        />
        {unit && <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

export function OnboardingWizard({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [draftChecked, setDraftChecked] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<keyof Draft["manualGoals"] | null>(null);
  const [goalEditValue, setGoalEditValue] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 进入时检测草稿(3.3.3:恢复/放弃)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        // 草稿超 7 天自动失效(3.3.4)
        if (d.savedAt && Date.now() - d.savedAt < 7 * 86400 * 1000) {
          setRestoring(true);
          setDraft((cur) => ({ ...cur, ...d }));
          return;
        }
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      setDraftChecked(true);
    }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // 变更后 2s 防抖保存草稿(3.3.2)
  useEffect(() => {
    if (!draftChecked) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
      } catch {
        /* 存储满等情况静默失败,不影响流程 */
      }
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, draftChecked]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  // 步骤 3:实时计算营养目标(手动项优先)
  const computedGoals = useMemo(() => {
    if (!draft.gender || !draft.age || !draft.weightKg || !draft.goalType || draft.weeklyTrainingDays == null) {
      return null;
    }
    return calcNutritionGoals({
      gender: draft.gender,
      age: draft.age,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      goalType: draft.goalType,
      weeklyTrainingDays: draft.weeklyTrainingDays,
    });
  }, [draft.gender, draft.age, draft.heightCm, draft.weightKg, draft.goalType, draft.weeklyTrainingDays]);

  function step1Valid() {
    return !!draft.gender && draft.age != null && draft.age >= 13 && draft.age <= 80 && draft.weightKg != null;
  }
  function step2Valid() {
    return !!draft.goalType && draft.weeklyTrainingDays != null;
  }
  function step4Valid() {
    if (draft.skipCycle) return true;
    return (
      !!draft.cycleName?.trim() &&
      !!draft.cycleStart &&
      !!draft.cycleEnd &&
      draft.cycleEnd > draft.cycleStart
    );
  }

  function next() {
    if (draft.step === 1 && !step1Valid()) return toast.error("请填写性别、年龄和当前体重");
    if (draft.step === 2 && !step2Valid()) return toast.error("请选择目标类型和每周训练次数");
    update({ step: Math.min(4, draft.step + 1) });
  }

  async function handleComplete() {
    if (submitting) return;
    if (!step1Valid() || !step2Valid()) {
      return toast.error("请先完成前两步的必填项");
    }
    if (!step4Valid()) {
      return toast.error("请填写完整的周期信息,或选择跳过");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: draft.gender,
          age: draft.age,
          heightCm: draft.heightCm ?? null,
          weightKg: draft.weightKg,
          bodyFatPct: draft.bodyFatPct ?? null,
          goalType: draft.goalType,
          targetWeightKg: draft.targetWeightKg ?? null,
          targetDate: draft.targetDate || null,
          weeklyTrainingDays: draft.weeklyTrainingDays,
          today: todayStr(),
          manualGoals: Object.keys(draft.manualGoals).length ? draft.manualGoals : undefined,
        }),
      });
      if (!res.ok) {
        toast.error("保存失败,请稍后再试");
        return;
      }

      // 第 4 步:创建周期(未跳过)
      if (!draft.skipCycle && draft.cycleName?.trim()) {
        const cycleRes = await fetch("/api/cycles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.cycleName.trim(),
            startDate: draft.cycleStart,
            endDate: draft.cycleEnd,
            today: todayStr(),
          }),
        });
        if (!cycleRes.ok) {
          toast.warning("设置已保存,但周期创建失败,可稍后在训练页创建");
        }
      }

      clearDraft();
      toast.success("设置完成,欢迎加入 FitMate!");
      router.push("/dashboard");
    } catch {
      toast.error("网络异常,请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  const goalRows: Array<{ key: keyof Draft["manualGoals"]; label: string; unit: string }> = [
    { key: "calories", label: "热量", unit: "kcal" },
    { key: "protein", label: "蛋白质", unit: "g" },
    { key: "carbs", label: "碳水", unit: "g" },
    { key: "fat", label: "脂肪", unit: "g" },
    { key: "waterMl", label: "饮水", unit: "ml" },
  ];

  if (restoring) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10 text-center">
        <h2 className="text-lg font-semibold">检测到未完成内容</h2>
        <p className="mt-2 text-muted-foreground">是否恢复上次编辑?</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            onClick={() => {
              setRestoring(false);
              toast.success("已恢复上次编辑");
            }}
          >
            恢复
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              clearDraft();
              setDraft(EMPTY_DRAFT);
              setRestoring(false);
            }}
          >
            放弃
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-6 pb-8 pt-6">
      {/* 顶部:进度指示 */}
      <div className="flex items-center gap-3">
        {draft.step > 1 ? (
          <Button variant="ghost" size="icon" onClick={() => update({ step: draft.step - 1 })} aria-label="上一步">
            ←
          </Button>
        ) : (
          <div className="size-9" />
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              步骤 {draft.step}/4 · {STEP_TITLES[draft.step - 1]}
            </span>
            <span>你好,{nickname}</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${s <= draft.step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex-1">
        {draft.step === 1 && (
          <div className="flex flex-col gap-5">
            <h1 className="text-xl font-bold">让我们认识一下你</h1>
            <div className="flex flex-col gap-2">
              <Label>性别 *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update({ gender: g })}
                    className={`rounded-lg border py-3 text-center transition-colors ${
                      draft.gender === g ? "border-primary bg-primary/10 font-medium" : "border-border"
                    }`}
                  >
                    {g === "male" ? "男" : "女"}
                  </button>
                ))}
              </div>
            </div>
            <NumField id="age" label="年龄" unit="岁" min={13} max={80} value={draft.age} onChange={(v) => update({ age: v })} />
            <NumField id="height" label="身高" unit="cm" min={100} max={250} value={draft.heightCm} onChange={(v) => update({ heightCm: v })} optional placeholder="未填按平均身高估算" />
            <NumField id="weight" label="当前体重" unit="kg" min={20} max={300} value={draft.weightKg} onChange={(v) => update({ weightKg: v })} />
            <NumField id="bodyFat" label="体脂率" unit="%" min={3} max={60} value={draft.bodyFatPct} onChange={(v) => update({ bodyFatPct: v })} optional />
          </div>
        )}

        {draft.step === 2 && (
          <div className="flex flex-col gap-5">
            <h1 className="text-xl font-bold">你的健身目标</h1>
            <div className="flex flex-col gap-2">
              <Label>目标类型 *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(GOAL_TYPE_LABEL) as GoalType[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update({ goalType: g })}
                    className={`rounded-lg border py-3 text-center transition-colors ${
                      draft.goalType === g ? "border-primary bg-primary/10 font-medium" : "border-border"
                    }`}
                  >
                    {GOAL_TYPE_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
            <NumField id="targetWeight" label="目标体重" unit="kg" min={20} max={300} value={draft.targetWeightKg} onChange={(v) => update({ targetWeightKg: v })} optional />
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetDate">目标完成日期(选填)</Label>
              <Input id="targetDate" type="date" value={draft.targetDate ?? ""} onChange={(e) => update({ targetDate: e.target.value || undefined })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>每周训练次数 *</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {Array.from({ length: 8 }, (_, i) => i).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ weeklyTrainingDays: d })}
                    className={`aspect-square rounded-lg border text-sm transition-colors ${
                      draft.weeklyTrainingDays === d ? "border-primary bg-primary/10 font-medium" : "border-border"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {draft.step === 3 && (
          <div className="flex flex-col gap-5">
            <h1 className="text-xl font-bold">你的营养目标</h1>
            <p className="text-sm text-muted-foreground">根据你的身体数据自动计算,可随时调整</p>
            {!computedGoals ? (
              <p className="text-sm text-destructive">请先完成前两步必填项</p>
            ) : (
              <div className="flex flex-col divide-y rounded-lg border">
                {goalRows.map(({ key, label, unit }) => {
                  const auto = computedGoals[key];
                  const val = draft.manualGoals[key] ?? auto;
                  const isManual = draft.manualGoals[key] != null;
                  return (
                    <div key={key} className="flex flex-col px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{label}</span>
                          {isManual && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">已手动调整</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {val} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingGoal(key); setGoalEditValue(String(val)); }}>
                            调整
                          </Button>
                        </div>
                      </div>
                      {editingGoal === key && (
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            className="h-8 w-28"
                            value={goalEditValue}
                            onChange={(e) => setGoalEditValue(e.target.value)}
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground">{unit}</span>
                          <Button
                            size="sm"
                            onClick={() => {
                              const v = Number(goalEditValue);
                              if (!Number.isFinite(v) || v <= 0) return toast.error("请输入有效数值");
                              const next = { ...draft.manualGoals, [key]: Math.round(v) };
                              update({ manualGoals: next });
                              setEditingGoal(null);
                            }}
                          >
                            保存
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingGoal(null)}>
                            取消
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {draft.step === 4 && (
          <div className="flex flex-col gap-5">
            <h1 className="text-xl font-bold">创建首个训练周期</h1>
            {!draft.skipCycle ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cycleName">周期名称 *</Label>
                  <Input id="cycleName" placeholder="如:增肌一期" maxLength={30} value={draft.cycleName ?? ""} onChange={(e) => update({ cycleName: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cycleStart">开始日期 *</Label>
                  <Input id="cycleStart" type="date" value={draft.cycleStart ?? ""} onChange={(e) => update({ cycleStart: e.target.value || undefined })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cycleEnd">结束日期 *</Label>
                  <Input id="cycleEnd" type="date" value={draft.cycleEnd ?? ""} onChange={(e) => update({ cycleEnd: e.target.value || undefined })} />
                </div>
                <button type="button" className="self-start text-sm text-muted-foreground underline underline-offset-2" onClick={() => update({ skipCycle: true })}>
                  跳过,稍后创建
                </button>
              </>
            ) : (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                已选择跳过。进入首页后可随时创建训练周期。
                <button type="button" className="ml-1 underline underline-offset-2" onClick={() => update({ skipCycle: false })}>
                  重新填写
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部:主按钮 */}
      <div className="mt-6">
        {draft.step < 4 ? (
          <Button size="lg" className="w-full" onClick={next}>
            下一步
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={handleComplete} disabled={submitting}>
            {submitting ? "保存中…" : "完成设置"}
          </Button>
        )}
      </div>
    </main>
  );
}
