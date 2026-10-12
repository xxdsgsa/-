"use client";

/**
 * 补剂表单(PRD 3.9.2):新建/编辑共用
 * 字段:名称(1~20)/ 单位(5 选 1)/ 单次剂量(>0,1 位小数)/ 每日目标(1~10,可空)
 *
 * 草稿自动保存(PRD 3.3):
 * - 2s debounce 写 localStorage(白名单:表单草稿,见 AGENTS.md)
 * - 切后台 / 关闭前立即存
 * - 进入页面读草稿 → 弹窗"恢复/放弃"
 * - 保存成功或主动放弃时清草稿
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DraftRestoreDialog } from "@/components/draft-restore-dialog";
import {
  clearDraft,
  draftKey,
  saveDraft,
  useAutoDraft,
} from "@/lib/hooks/use-draft";
import type { SupplementUnit, SupplementView } from "@/lib/db/queries/supplements";
import { SUPPLEMENT_UNITS, SUPPLEMENT_UNIT_LABELS } from "@/lib/db/queries/supplements";

const WEIGHT_RE = /^\d{1,4}(\.\d)?$/;

interface Initial {
  name: string;
  unit: SupplementUnit;
  dose: number;
  dailyTarget: number | null;
}

type Props =
  | { mode: "create"; userId: string }
  | { mode: "edit"; userId: string; id: string; initial: Initial };

interface FormState {
  name: string;
  unit: SupplementUnit;
  dose: string;
  hasTarget: boolean;
  target: string;
}

function stateFromInitial(initial: Initial | null, unitDefault: SupplementUnit): FormState {
  if (!initial) return { name: "", unit: unitDefault, dose: "", hasTarget: false, target: "" };
  return {
    name: initial.name,
    unit: initial.unit,
    dose: String(initial.dose),
    hasTarget: initial.dailyTarget !== null,
    target: initial.dailyTarget !== null ? String(initial.dailyTarget) : "",
  };
}

export function SupplementForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  const formId =
    props.mode === "create"
      ? "new"
      : `edit-${props.id}`;
  const key = useMemo(
    () => draftKey("supplement", props.userId, formId),
    [props.userId, formId],
  );

  const [state, setState] = useState<FormState>(() => stateFromInitial(initial, "g"));
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);

  // 自动保存(2s debounce + 切后台立即存)
  useAutoDraft<FormState>(key, state);

  function patch(p: Partial<FormState>) {
    setState((s) => ({ ...s, ...p }));
  }

  // 防止"页面打开未填任何内容就触发空草稿覆盖"——restored 后才存
  useEffect(() => {
    if (!restored) return;
    saveDraft(key, state);
    // 只在 restored 翻 true 那次跑一次即可
  }, [restored]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    if (!state.name.trim() || state.name.length > 20) {
      toast.error("名称须为 1~20 字");
      return;
    }
    if (!WEIGHT_RE.test(state.dose) || Number(state.dose) <= 0) {
      toast.error("单次剂量须 >0,最多 1 位小数");
      return;
    }
    let dailyTarget: number | null = null;
    if (state.hasTarget) {
      const t = Number(state.target);
      if (!Number.isInteger(t) || t < 1 || t > 10) {
        toast.error("每日目标须为 1~10 的整数");
        return;
      }
      dailyTarget = t;
    }

    setSaving(true);
    try {
      const url = props.mode === "create" ? "/api/supplements" : `/api/supplements/${props.id}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name.trim(),
          unit: state.unit,
          dose: Number(state.dose),
          ...(state.hasTarget ? { dailyTarget } : { dailyTarget: null }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "保存失败");
        return;
      }
      // 保存成功清草稿(3.3.4)
      clearDraft(key);
      toast.success(props.mode === "create" ? "已添加" : "已保存");
      router.push("/supplements");
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* 恢复草稿弹窗:仅在挂载时检查一次,数据回到 state 后 setRestored 翻 true */}
      <DraftRestoreDialog<FormState>
        keyName={key}
        onRestore={(d) => {
          setState(d);
          setRestored(true);
        }}
        onDiscard={() => setRestored(true)}
      />

      <div className="space-y-1.5">
        <Label htmlFor="sup-name">名称</Label>
        <Input
          id="sup-name"
          value={state.name}
          maxLength={20}
          placeholder="如:乳清蛋白"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>单位</Label>
        <div className="grid grid-cols-5 gap-2">
          {SUPPLEMENT_UNITS.map((u) => (
            <Button
              key={u}
              type="button"
              size="sm"
              variant={state.unit === u ? "default" : "outline"}
              onClick={() => patch({ unit: u })}
            >
              {SUPPLEMENT_UNIT_LABELS[u]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sup-dose">单次剂量</Label>
        <div className="flex items-center gap-2">
          <Input
            id="sup-dose"
            inputMode="decimal"
            className="w-24"
            value={state.dose}
            placeholder="如:5"
            onChange={(e) => patch({ dose: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">
            {SUPPLEMENT_UNIT_LABELS[state.unit]} / 次
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="sup-target">每日目标(可选)</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => patch({ hasTarget: !state.hasTarget })}
          >
            {state.hasTarget ? "清除" : "设置"}
          </Button>
        </div>
        {state.hasTarget ? (
          <Input
            id="sup-target"
            inputMode="numeric"
            className="w-24"
            value={state.target}
            placeholder="1~10"
            onChange={(e) => patch({ target: e.target.value })}
          />
        ) : (
          <p className="text-xs text-muted-foreground">不设置则不显示目标进度</p>
        )}
      </div>

      <Button className="w-full" disabled={saving} onClick={save}>
        {saving ? "保存中…" : props.mode === "create" ? "添加补剂" : "保存修改"}
      </Button>
    </div>
  );
}

// re-export for type usage
export type { SupplementView };
