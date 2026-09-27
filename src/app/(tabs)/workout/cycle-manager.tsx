"use client";

/**
 * 训练周期管理(PRD 3.1.2~3.1.4)
 *
 * - 顶栏:周期切换(Sheet 列表)+ 新建(+)
 * - 周期卡:编辑 / 激活(未开始)/ 删除(软删,历史保留 3.1.11)
 * - 创建/激活遇已有进行中周期 → 409,确认"结束并激活新周期?"后带 force 重发(3.1.4)
 * - 周计划/动作库为后续迭代(WORKOUT-002+),此处仅占位说明
 */
import { ChevronDown, Pencil, Play, Plus, Trash2 } from "lucide-react";
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
import { cycleWeeks, formatDateRange } from "@/lib/cycles";

export interface CycleView {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

/** 客户端"今日"(设备时区日历日,ADR-12):YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "进行中"
      ? "bg-emerald-100 text-emerald-700"
      : status === "未开始"
        ? "bg-amber-100 text-amber-700"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export function CycleManager({ cycles }: { cycles: CycleView[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(cycles[0]?.id ?? null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CycleView | null>(null); // null = 新建
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null;
  const formValid = name.trim() !== "" && startDate !== "" && endDate !== "" && endDate > startDate;

  function openCreate() {
    setEditing(null);
    setName("");
    setStartDate(todayStr());
    setEndDate("");
    setFormOpen(true);
  }

  function openEdit(cycle: CycleView) {
    setEditing(cycle);
    setName(cycle.name);
    setStartDate(cycle.startDate);
    setEndDate(cycle.endDate);
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    try {
      const isCreate = editing === null;
      const res = await fetch(isCreate ? "/api/cycles" : `/api/cycles/${editing.id}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate, endDate, today: todayStr() }),
      });
      const body = (await res.json().catch(() => null)) as {
        success: boolean;
        error?: { code: string; message: string };
      } | null;

      // 409:已有进行中周期 → 确认"结束并激活新周期?"(3.1.4)后带 force 重发
      if (res.status === 409 && isCreate && body?.error) {
        if (window.confirm(body.error.message)) {
          // TODO(ui): 换 AlertDialog
          const retry = await fetch("/api/cycles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), startDate, endDate, today: todayStr(), force: true }),
          });
          if (retry.ok) {
            toast.success("训练周期创建成功");
            setFormOpen(false);
            router.refresh();
          } else {
            toast.error("创建失败,请重试");
          }
        }
        return;
      }

      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "保存失败,请重试");
        return;
      }
      toast.success(isCreate ? "训练周期创建成功" : "周期已更新");
      setFormOpen(false);
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(cycle: CycleView) {
    const activate = async (force: boolean) => {
      const res = await fetch(`/api/cycles/${cycle.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const body = (await res.json().catch(() => null)) as {
        success: boolean;
        error?: { message: string };
      } | null;
      if (res.status === 409 && !force && body?.error) {
        if (window.confirm(body.error.message)) {
          // TODO(ui): 换 AlertDialog
          await activate(true);
        }
        return;
      }
      if (!res.ok || !body?.success) {
        toast.error(body?.error?.message ?? "激活失败,请重试");
        return;
      }
      toast.success("周期已激活");
      router.refresh();
    };
    try {
      await activate(false);
    } catch {
      toast.error("网络异常,请检查网络后重试");
    }
  }

  async function handleDelete(cycle: CycleView) {
    if (!window.confirm(`确定删除『${cycle.name}』吗?训练历史仍会保留。`)) return; // TODO(ui): 换 AlertDialog
    try {
      const res = await fetch(`/api/cycles/${cycle.id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { success: boolean } | null;
      if (!res.ok || !body?.success) {
        toast.error("删除失败,请重试");
        return;
      }
      toast.success("周期已删除");
      router.refresh();
    } catch {
      toast.error("网络异常,请检查网络后重试");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">训练计划</h1>
        {cycles.length > 0 && (
          <Button size="icon" variant="outline" onClick={openCreate} aria-label="新建训练周期">
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      {cycles.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <p className="text-4xl">📅</p>
          <p className="font-medium">还没有训练计划</p>
          <p className="text-sm text-muted-foreground">创建你的第一套训练计划</p>
          <Button className="mt-2" onClick={openCreate}>
            立即创建
          </Button>
        </div>
      ) : (
        selected && (
          <div className="mt-4 space-y-3">
            {/* 周期切换(3.1.2 顶部导航:当前训练周期可切换) */}
            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="font-semibold">{selected.name}</span>
                <StatusBadge status={selected.status} />
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {/* 周期卡:日期区间 / 周数 / 操作 */}
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">
                {formatDateRange(selected.startDate, selected.endDate)}
                <span className="ml-2">共 {cycleWeeks(selected.startDate, selected.endDate)} 周</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                  <Pencil className="size-3.5" />
                  编辑
                </Button>
                {selected.status === "未开始" && (
                  <Button variant="outline" size="sm" onClick={() => handleActivate(selected)}>
                    <Play className="size-3.5" />
                    激活
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(selected)}
                >
                  <Trash2 className="size-3.5" />
                  删除
                </Button>
              </div>
            </div>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              周计划与动作库建设中(WORKOUT-002+)
            </p>
          </div>
        )
      )}

      {/* 周期切换列表 */}
      <Sheet open={switcherOpen} onOpenChange={setSwitcherOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>切换训练周期</SheetTitle>
            <SheetDescription>选择要查看的周期;已结束周期数据完整保留</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-8">
            {cycles.map((cycle) => (
              <button
                key={cycle.id}
                type="button"
                onClick={() => {
                  setSelectedId(cycle.id);
                  setSwitcherOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                  cycle.id === selected.id ? "border-primary" : ""
                }`}
              >
                <span>
                  <span className="block text-sm font-medium">{cycle.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateRange(cycle.startDate, cycle.endDate)}
                  </span>
                </span>
                <StatusBadge status={cycle.status} />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* 新建 / 编辑周期(3.1.4) */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "编辑训练周期" : "新建训练周期"}</SheetTitle>
            <SheetDescription>同一时间仅允许一个周期处于进行中</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="cycle-name">训练周期名称</Label>
              <Input
                id="cycle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如:增肌一期"
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-start">开始日期</Label>
              <Input
                id="cycle-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-end">结束日期</Label>
              <Input
                id="cycle-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!formValid || submitting}
              >
                {submitting ? "保存中…" : editing ? "保存" : "创建"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
