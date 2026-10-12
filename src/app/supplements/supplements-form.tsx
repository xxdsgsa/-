"use client";

/**
 * 补剂表单(PRD 3.9.2):新建/编辑共用
 * 字段:名称(1~20)/ 单位(5 选 1)/ 单次剂量(>0,1 位小数)/ 每日目标(1~10,可空)
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  | { mode: "create" }
  | { mode: "edit"; id: string; initial: Initial };

export function SupplementForm(props: Props) {
  const router = useRouter();
  const [name, setName] = useState(props.mode === "edit" ? props.initial.name : "");
  const [unit, setUnit] = useState<SupplementUnit>(
    props.mode === "edit" ? props.initial.unit : "g",
  );
  const [dose, setDose] = useState(
    props.mode === "edit" ? String(props.initial.dose) : "",
  );
  const [hasTarget, setHasTarget] = useState(
    props.mode === "edit" ? props.initial.dailyTarget !== null : false,
  );
  const [target, setTarget] = useState(
    props.mode === "edit" && props.initial.dailyTarget !== null
      ? String(props.initial.dailyTarget)
      : "",
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!name.trim() || name.length > 20) {
      toast.error("名称须为 1~20 字");
      return;
    }
    if (!WEIGHT_RE.test(dose) || Number(dose) <= 0) {
      toast.error("单次剂量须 >0,最多 1 位小数");
      return;
    }
    let dailyTarget: number | null = null;
    if (hasTarget) {
      const t = Number(target);
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
          name: name.trim(),
          unit,
          dose: Number(dose),
          ...(hasTarget ? { dailyTarget } : { dailyTarget: null }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "保存失败");
        return;
      }
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
      <div className="space-y-1.5">
        <Label htmlFor="sup-name">名称</Label>
        <Input
          id="sup-name"
          value={name}
          maxLength={20}
          placeholder="如:乳清蛋白"
          onChange={(e) => setName(e.target.value)}
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
              variant={unit === u ? "default" : "outline"}
              onClick={() => setUnit(u)}
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
            value={dose}
            placeholder="如:5"
            onChange={(e) => setDose(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">
            {SUPPLEMENT_UNIT_LABELS[unit]} / 次
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
            onClick={() => setHasTarget((v) => !v)}
          >
            {hasTarget ? "清除" : "设置"}
          </Button>
        </div>
        {hasTarget ? (
          <Input
            id="sup-target"
            inputMode="numeric"
            className="w-24"
            value={target}
            placeholder="1~10"
            onChange={(e) => setTarget(e.target.value)}
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
