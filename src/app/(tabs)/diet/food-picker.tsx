"use client";

/**
 * 添加食物 Sheet(PRD 3.8.3/3.8.4)
 *
 * 三 mode:
 * - search 搜索食物库(官方+我的,名称包含;无结果→创建入口)
 * - entry  选中后输入重量(默认 100;液态可切 ml)+ 营养预览 + 保存
 * - create 创建自定义食物(名称 + 每 100g 四项),保存后直接进入录入
 */
import { ChevronLeft, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
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
import type { FoodView, MealType } from "@/lib/db/queries/diet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 记录日期(YYYY-MM-DD,页签当前日期) */
  date: string;
  mealType: MealType;
  mealLabel: string;
  /** 保存成功后回调(刷新页面数据) */
  onSaved: () => void;
}

/** grams × per100 / 100,取整 */
function per(per100: number, grams: number): number {
  return Math.round((per100 * grams) / 100);
}

/** 重量校验(3.8.3):1~5000,最多 1 位小数 */
function validGrams(v: string): number | null {
  if (!/^\d{1,4}(\.\d)?$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 5000 ? n : null;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: unknown; error?: { message?: string } }
    | null;
  return { status: res.status, json };
}

export function FoodPicker({ open, onOpenChange, date, mealType, mealLabel, onSaved }: Props) {
  const [mode, setMode] = useState<"search" | "entry" | "create">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodView[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodView | null>(null);
  const [grams, setGrams] = useState("100");
  const [unit, setUnit] = useState<"g" | "ml">("g");
  const [saving, setSaving] = useState(false);
  // 自定义食物表单
  const [cname, setCname] = useState("");
  const [ckcal, setCkcal] = useState("");
  const [cprotein, setCprotein] = useState("");
  const [ccarbs, setCcarbs] = useState("");
  const [cfat, setCfat] = useState("");
  const [cliquid, setCliquid] = useState(false);

  // 打开时重置到搜索态;关闭清空
  useEffect(() => {
    const t = setTimeout(() => {
      if (open) {
        setMode("search");
        setQ("");
        setSelected(null);
        setGrams("100");
        setUnit("g");
      }
    });
    return () => clearTimeout(t);
  }, [open]);

  // 搜索防抖 300ms(官方+我的联合,每页 20)
  useEffect(() => {
    if (!open || mode !== "search") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = q.trim() ? `/api/foods?search=${encodeURIComponent(q.trim())}` : "/api/foods";
        const res = await fetch(url);
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { foods?: FoodView[] } }
          | null;
        if (!cancelled && res.ok && json?.success) setResults(json.data?.foods ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, mode]);

  function pickEntry(food: FoodView) {
    setSelected(food);
    setGrams("100");
    setUnit("g");
    setMode("entry");
  }

  async function saveItem() {
    if (!selected) return;
    const g = validGrams(grams);
    if (g == null) {
      toast.error("请输入 1~5000 之间的数值");
      return;
    }
    setSaving(true);
    const r = await postJson("/api/diet/items", {
      date,
      mealType,
      foodId: selected.id,
      grams: g,
    });
    setSaving(false);
    if (r.status === 201 && r.json?.success) {
      toast.success(`已添加到${mealLabel}`);
      onOpenChange(false);
      onSaved();
    } else {
      toast.error((r.json?.error?.message as string) ?? "保存失败,请重试");
    }
  }

  async function createFood() {
    const kcal = Number(ckcal);
    const p = Number(cprotein);
    const c = Number(ccarbs);
    const f = Number(cfat);
    if (!cname.trim() || cname.trim().length > 30) {
      toast.error("请输入 1~30 字的食物名称");
      return;
    }
    if (!Number.isInteger(kcal) || kcal < 0 || kcal > 1000) {
      toast.error("热量需为 0~1000 的整数(kcal/100g)");
      return;
    }
    for (const [v, label] of [[p, "蛋白质"], [c, "碳水"], [f, "脂肪"]] as const) {
      if (!(v >= 0 && v <= 100) || Math.round(v * 10) !== v * 10) {
        toast.error(`${label}需为 0~100,最多 1 位小数(g/100g)`);
        return;
      }
    }
    setSaving(true);
    const r = await postJson("/api/foods", {
      name: cname.trim(),
      kcalPer100: kcal,
      proteinPer100: p,
      carbsPer100: c,
      fatPer100: f,
      isLiquid: cliquid,
    });
    setSaving(false);
    if (r.status === 201 && r.json?.success) {
      toast.success("已保存到我的食物");
      pickEntry({
        id: (r.json?.data as { food: { id: string } }).food.id,
        name: cname.trim(),
        kcalPer100: kcal,
        proteinPer100: String(p),
        carbsPer100: String(c),
        fatPer100: String(f),
        isLiquid: cliquid,
        owner: "mine",
      });
    } else {
      toast.error((r.json?.error?.message as string) ?? "创建失败,请重试");
    }
  }

  const g = Number(grams) || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[85vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="px-0">
          <SheetTitle>
            {mode === "create" ? "创建自定义食物" : `添加食物 · ${mealLabel}`}
          </SheetTitle>
          <SheetDescription asChild>
            <span className="sr-only">{"搜索食物库或创建自定义食物"}</span>
          </SheetDescription>
        </SheetHeader>

        {/* mode: 搜索 */}
        {mode === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索食物名称"
                className="pl-9"
                autoFocus
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">没有找到相关食物</p>
                <Button size="sm" variant="outline" onClick={() => setMode("create")}>
                  <Plus className="size-4" /> 创建自定义食物
                </Button>
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {results.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pickEntry(f)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {f.name}
                        {f.owner === "mine" && (
                          <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                            我的
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {f.kcalPer100} kcal/100{f.isLiquid ? "ml" : "g"}
                      </p>
                    </div>
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            {results.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("create")}>
                <Plus className="size-4" /> 创建自定义食物
              </Button>
            )}
          </div>
        )}

        {/* mode: 录入重量 + 预览 */}
        {mode === "entry" && selected && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("search")}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ChevronLeft className="size-4" /> 重新选择
            </button>
            <div className="rounded-lg border bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-muted-foreground">
                每 100{selected.isLiquid ? "ml" : "g"}:{selected.kcalPer100} kcal · 蛋白{" "}
                {Number(selected.proteinPer100)}g · 碳水 {Number(selected.carbsPer100)}g · 脂肪{" "}
                {Number(selected.fatPer100)}g
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-grams">重量(1~5000,最多 1 位小数)</Label>
              <div className="flex gap-2">
                <Input
                  id="fp-grams"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  inputMode="decimal"
                  className="flex-1"
                />
                {selected.isLiquid ? (
                  <div className="flex overflow-hidden rounded-lg border">
                    {(["g", "ml"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className={`w-10 text-sm ${unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex w-10 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                    g
                  </div>
                )}
              </div>
            </div>
            {/* 营养预览(3.8.3:保存前展示) */}
            <div className="grid grid-cols-4 gap-2 rounded-lg border bg-card p-3 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{per(selected.kcalPer100, g)}</p>
                <p className="text-[10px] text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">
                  {per(Number(selected.proteinPer100), g)}
                </p>
                <p className="text-[10px] text-muted-foreground">蛋白g</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">
                  {per(Number(selected.carbsPer100), g)}
                </p>
                <p className="text-[10px] text-muted-foreground">碳水g</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{per(Number(selected.fatPer100), g)}</p>
                <p className="text-[10px] text-muted-foreground">脂肪g</p>
              </div>
            </div>
            <Button className="w-full" disabled={saving} onClick={saveItem}>
              {saving && <Loader2 className="size-4 animate-spin" />} 保存
            </Button>
          </div>
        )}

        {/* mode: 创建自定义食物 */}
        {mode === "create" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("search")}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ChevronLeft className="size-4" /> 返回搜索
            </button>
            <div className="space-y-2">
              <Label htmlFor="cf-name">食物名称 *</Label>
              <Input
                id="cf-name"
                value={cname}
                onChange={(e) => setCname(e.target.value)}
                placeholder="如:妈妈牌红烧肉"
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-kcal">热量(kcal / 100g)*</Label>
              <Input
                id="cf-kcal"
                value={ckcal}
                onChange={(e) => setCkcal(e.target.value)}
                inputMode="numeric"
                placeholder="0~1000"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["蛋白", cprotein, setCprotein],
                  ["碳水", ccarbs, setCcarbs],
                  ["脂肪", cfat, setCfat],
                ] as const
              ).map(([label, val, set]) => (
                <div key={label} className="space-y-2">
                  <Label htmlFor={`cf-${label}`}>{label}(g)*</Label>
                  <Input
                    id={`cf-${label}`}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    inputMode="decimal"
                    placeholder="0~100"
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cliquid}
                onChange={(e) => setCliquid(e.target.checked)}
                className="size-4"
              />
              液态食物(单位用 ml)
            </label>
            <Button className="w-full" disabled={saving} onClick={createFood}>
              {saving && <Loader2 className="size-4 animate-spin" />} 保存并选用
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
