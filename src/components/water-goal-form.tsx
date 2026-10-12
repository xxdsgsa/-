"use client";

/**
 * 饮水目标调整表单(PRD 3.6.7 设置入口)
 * 设置后标 manualWater=true(3.4.3:手动项系统不自动覆盖);
 * 也可"恢复自动"清除标记。
 */
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: number | null;
  manual: boolean;
}

export function WaterGoalForm({ open, onOpenChange, current, manual }: Props) {
  const router = useRouter();
  const [ml, setMl] = useState(current ? String(current) : "2000");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(ml);
    if (!Number.isInteger(n) || n < 500 || n > 6000) {
      toast.error("饮水目标须在 500~6000 ml");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/water-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waterMl: n }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "保存失败");
        return;
      }
      toast.success("已保存");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/water-goal", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "清除失败");
        return;
      }
      toast.success("已恢复按体重自动计算");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>饮水目标</SheetTitle>
          <SheetDescription>
            默认按体重 × 35ml 自动计算;可手动调整
            {manual && <span className="ml-1 text-orange-500">已手动调整</span>}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="water-goal">每日目标(ml)</Label>
            <Input
              id="water-goal"
              inputMode="numeric"
              value={ml}
              onChange={(e) => setMl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">范围 500~6000 ml</p>
          </div>
          <Button className="w-full" disabled={saving} onClick={save}>
            {saving ? "保存中…" : "保存"}
          </Button>
          {manual && (
            <Button
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={reset}
            >
              恢复按体重自动计算
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
