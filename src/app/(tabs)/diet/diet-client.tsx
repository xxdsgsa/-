"use client";

/**
 * 饮食页交互层(PRD 3.8.2~3.8.7)
 *
 * - 日期选择器:今日及过去 7 天(3.8.8 补记窗口),←/→ 步进,超窗只读
 * - 四餐次卡片:条目列表 + kcal 小计 +【+ 添加食物】;点击条目编辑(改重量/删除)
 * - 今日统计条:四项总值 × 目标进度条(3.8.6,超标提示不阻断)
 * - 补剂/饮水快捷卡:复用首页卡片(3.8.2)
 */
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SupplementCard, WaterCard } from "@/app/(tabs)/dashboard/cards";
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
import type { DashboardData } from "@/lib/db/queries/dashboard";
import type { DietDayView, DietItemView, MealType } from "@/lib/db/queries/diet";

import { FoodPicker } from "./food-picker";

export interface DayChip {
  date: string;
  /** 今天 / 昨天 / 9月30日 */
  label: string;
}

interface Props {
  view: DietDayView;
  days: DayChip[];
  water: DashboardData["water"];
  supplements: DashboardData["supplements"];
}

function per(per100: number, grams: number): number {
  return Math.round((per100 * grams) / 100);
}

function validGrams(v: string): number | null {
  if (!/^\d{1,4}(\.\d)?$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 5000 ? n : null;
}

/** 四项统计 × 目标进度条(3.8.6) */
function StatBars({ view }: { view: DietDayView }) {
  const rows = [
    { label: "热量", cur: view.totals.kcal, goal: view.goals.kcal, unit: "kcal" },
    { label: "蛋白", cur: view.totals.protein, goal: view.goals.protein, unit: "g" },
    { label: "碳水", cur: view.totals.carbs, goal: view.goals.carbs, unit: "g" },
    { label: "脂肪", cur: view.totals.fat, goal: view.goals.fat, unit: "g" },
  ];
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((r) => {
          const p = r.goal && r.goal > 0 ? Math.min(Math.round((r.cur / r.goal) * 100), 100) : null;
          const over = r.goal != null && r.goal > 0 && r.cur > r.goal;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={`tabular-nums ${over ? "font-semibold text-amber-600" : ""}`}>
                  {r.cur}
                  {r.goal != null ? `/${r.goal}` : ""} {r.unit}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                {p != null && (
                  <div
                    className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${p}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 条目编辑弹窗(3.8.5:改重量自动重算 / 删除二次确认) */
function ItemSheet({
  item,
  onSaved,
}: {
  item: DietItemView | null;
  onSaved: () => void;
}) {
  const [grams, setGrams] = useState(item ? String(item.grams) : "");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // 条目切换时重置输入(lastTarget 派生初始化模式)
  const [lastId, setLastId] = useState(item?.id ?? null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setGrams(String(item.grams));
    setConfirming(false);
  }

  const g = Number(grams) || 0;

  async function save() {
    if (!item) return;
    const v = validGrams(grams);
    if (v == null) {
      toast.error("请输入 1~5000 之间的数值");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/diet/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: v }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("已更新");
      onSaved();
    } else {
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      toast.error(json?.error?.message ?? "保存失败,请重试");
    }
  }

  async function remove() {
    if (!item) return;
    setSaving(true);
    const res = await fetch(`/api/diet/items/${item.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      toast.success("已删除");
      onSaved();
    } else {
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      toast.error(json?.error?.message ?? "删除失败,请重试");
    }
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onSaved()}>
      <SheetContent className="px-4 pb-6">
        <SheetHeader className="px-0">
          <SheetTitle>{item?.foodName}</SheetTitle>
          <SheetDescription asChild>
            <span className="sr-only">{"修改重量或删除该条记录"}</span>
          </SheetDescription>
        </SheetHeader>
        {item && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ie-grams">重量(1~5000,最多 1 位小数)</Label>
              <div className="flex gap-2">
                <Input
                  id="ie-grams"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  inputMode="decimal"
                  className="flex-1"
                />
                <div className="flex w-10 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                  g
                </div>
              </div>
            </div>
            {/* 重算预览(3.2.10) */}
            <div className="grid grid-cols-4 gap-2 rounded-lg border bg-card p-3 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{per(item.kcalPer100, g)}</p>
                <p className="text-[10px] text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">
                  {per(Number(item.proteinPer100), g)}
                </p>
                <p className="text-[10px] text-muted-foreground">蛋白g</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">
                  {per(Number(item.carbsPer100), g)}
                </p>
                <p className="text-[10px] text-muted-foreground">碳水g</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{per(Number(item.fatPer100), g)}</p>
                <p className="text-[10px] text-muted-foreground">脂肪g</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-destructive"
                disabled={saving}
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="size-4" /> 删除
              </Button>
              <Button className="flex-1" disabled={saving} onClick={save}>
                {saving && <Loader2 className="size-4 animate-spin" />} 保存
              </Button>
            </div>

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除这条记录?</AlertDialogTitle>
                  <AlertDialogDescription>
                    删除后 {item.foodName} 的这条记录不可恢复,统计将自动重算。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function DietClient({ view, days, water, supplements }: Props) {
  const router = useRouter();
  const [pickerMeal, setPickerMeal] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<DietItemView | null>(null);

  const today = days[days.length - 1]?.date;
  const idx = days.findIndex((d) => d.date === view.date);
  const chip = idx >= 0 ? days[idx] : null;

  function goDate(date: string) {
    router.push(`/diet?date=${date}`);
  }

  function refresh() {
    setEditing(null);
    router.refresh();
  }

  const allEmpty = view.meals.every((m) => m.items.length === 0);
  const isToday = view.date === today;

  return (
    <main className="mx-auto w-full max-w-sm px-4 pb-24 pt-4">
      {/* 日期选择器:← 今天 · 10月8日 →(3.8.8:今日及过去 7 天) */}
      <div className="flex items-center justify-between">
        <Button
          size="icon"
          variant="ghost"
          disabled={idx <= 0 || idx < 0}
          onClick={() => idx > 0 && goDate(days[idx - 1].date)}
          aria-label="前一天"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">
            {isToday ? "今天" : chip ? chip.label : view.weekday} · {view.dayLabel}
          </p>
          {!view.editable && (
            <p className="text-[10px] text-muted-foreground">超出 7 天补记窗口,只读</p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          disabled={idx < 0 || idx >= days.length - 1}
          onClick={() => idx >= 0 && idx < days.length - 1 && goDate(days[idx + 1].date)}
          aria-label="后一天"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* 今日无记录整页空态(3.8.7) */}
      {allEmpty && isToday && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-4xl">🍽️</p>
          <p className="text-sm text-muted-foreground">今天还没有记录饮食</p>
          <Button size="sm" onClick={() => setPickerMeal("breakfast")}>
            <Plus className="size-4" /> 记录第一餐
          </Button>
        </div>
      )}

      {/* 四餐次卡片 */}
      <div className="mt-4 space-y-3">
        {view.meals.map((meal) => (
          <div key={meal.mealType} className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
              <p className="text-sm font-medium">
                {meal.label}
                {meal.items.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                    {meal.kcal} kcal
                  </span>
                )}
              </p>
              {view.editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPickerMeal(meal.mealType)}
                  aria-label={`添加${meal.label}食物`}
                >
                  <Plus className="size-4" /> 添加食物
                </Button>
              )}
            </div>
            {meal.items.length === 0 ? (
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground">暂无记录</p>
                {view.editable && (
                  <Button size="sm" variant="outline" onClick={() => setPickerMeal(meal.mealType)}>
                    <Plus className="size-4" /> 添加食物
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {meal.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => view.editable && setEditing(it)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                      view.editable ? "active:bg-muted" : "cursor-default"
                    }`}
                  >
                    <p className="min-w-0 truncate text-sm">{it.foodName}</p>
                    <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {it.grams}g · {it.kcal} kcal
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 补剂 / 饮水快捷卡(3.8.2) */}
      <div className="mt-3 space-y-3">
        <SupplementCard supplements={supplements} />
        <WaterCard water={water} />
      </div>

      {/* 今日统计(3.8.6) */}
      <div className="mt-3">
        <StatBars view={view} />
      </div>

      {/* 添加食物 Sheet */}
      {pickerMeal && (
        <FoodPicker
          open={!!pickerMeal}
          onOpenChange={(o) => !o && setPickerMeal(null)}
          date={view.date}
          mealType={pickerMeal}
          mealLabel={
            view.meals.find((m) => m.mealType === pickerMeal)?.label ?? ""
          }
          onSaved={refresh}
        />
      )}

      {/* 条目编辑 Sheet */}
      <ItemSheet item={editing} onSaved={refresh} />
    </main>
  );
}
