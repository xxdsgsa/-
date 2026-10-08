"use client";

/**
 * 首页五卡片(PRD 3.7.2~3.7.7,客户端交互层)
 *
 * - 训练卡:六态只读 + 撤销未完成(3.1.9,仅当日,就地 DELETE)
 * - 营养卡:只读,点击进饮食页;超标变橙 + 提示(3.2.10)
 * - 饮水卡:+100/+250/+500 就地记录,乐观更新(3.7.5)
 * - 补剂卡:打卡 Bottom Sheet——选补剂 → 剂量 → 保存(3.9.3)
 * - 体重卡:记录 Sheet + 同日覆盖确认(3.2.6;409 → 二次确认 → 重发)
 *
 * 写操作成功后 router.refresh() 与服务端数据同步(3.2.12);
 * 快速开始落地为各卡片内按钮,不设独立操作区(3.7.2 决策)。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateLabel } from "@/lib/date";
import type { DashboardData, TrainingCardState } from "@/lib/db/queries/dashboard";
import { cn } from "cn";
import { Droplets, Dumbbell, Flame, Pill, Scale } from "lucide-react";

/* ---------------------------------- 小工具 ---------------------------------- */

/** 完成度百分比;无目标返回 null */
function pct(current: number, goal: number | null): number | null {
  if (goal == null || goal <= 0) return null;
  return Math.round((current / goal) * 100);
}

/** 超标提示色(3.2.10/3.2.11:橙色,仅提示不阻断) */
const OVER_TEXT = "text-orange-600 dark:text-orange-400";

/** 补剂单位中文(schema 枚举 → 展示,3.9.2) */
const SUPPLEMENT_UNIT_LABEL: Record<string, string> = {
  scoop: "勺",
  g: "g",
  pill: "粒",
  tablet: "片",
  ml: "ml",
};

function unitLabel(unit: string): string {
  return SUPPLEMENT_UNIT_LABEL[unit] ?? unit;
}

/** 卡片图标位 */
function CardIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {children}
    </div>
  );
}

/* --------------------------------- 进度组件 --------------------------------- */

/** 横向进度条(超标变橙并封顶 100%,3.7.4) */
function Bar({
  current,
  goal,
  className,
}: {
  current: number;
  goal: number | null;
  className?: string;
}) {
  const p = pct(current, goal);
  const ratio = p == null ? 0 : Math.min(p, 100) / 100;
  const over = p != null && p > 100;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-300", over ? "bg-orange-500" : "bg-primary")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

/** 饮水进度环(手写 SVG,V1 图表口径) */
function WaterRing({ current, goal }: { current: number; goal: number | null }) {
  const p = pct(current, goal);
  const ratio = p == null ? 0 : Math.min(p, 100) / 100;
  const over = p != null && p > 100;
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90">
        <circle cx="38" cy="38" r={R} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className={cn("transition-all duration-300", over ? "stroke-orange-500" : "stroke-primary")}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - ratio)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {p ?? "--"}%
      </span>
    </div>
  );
}

/* ---------------------------------- 容器 ---------------------------------- */

export function DashboardCards({
  data,
  today,
  dateLabel,
  greeting,
  nickname,
}: {
  data: DashboardData;
  today: string;
  dateLabel: string;
  greeting: string;
  nickname: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-1 px-1">
        <p className="text-sm text-muted-foreground">今天 · {dateLabel}</p>
        <h1 className="text-xl font-bold">
          {greeting},{nickname}
        </h1>
      </header>

      <TrainingCard training={data.training} today={today} />
      <NutritionCard nutrition={data.nutrition} />
      <WaterCard water={data.water} />
      <SupplementCard supplements={data.supplements} />
      <WeightCard weight={data.weight} />
    </div>
  );
}

/* --------------------------------- 训练卡 ---------------------------------- */

const TRAINING_BADGE: Partial<Record<TrainingCardState, string>> = {
  not_started: "○",
  rest: "💤",
  completed: "✅",
  missed: "❌",
};

function TrainingCard({ training, today }: { training: DashboardData["training"]; today: string }) {
  const router = useRouter();
  const [undoing, setUndoing] = useState(false);

  async function undo() {
    setUndoing(true);
    try {
      const res = await fetch(`/api/day-marks?date=${today}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "撤销失败,请重试");
        return;
      }
      toast.success("已撤销,今天可以开始训练啦");
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setUndoing(false);
    }
  }

  const { state, title } = training;
  const badge = TRAINING_BADGE[state];

  const subtitle =
    state === "no_cycle"
      ? "创建周期,开始你的训练计划"
      : state === "no_plan"
        ? "周期内今天没有安排训练"
        : state === "rest"
          ? "好好休息,恢复也是训练的一部分"
          : state === "not_started"
            ? training.exerciseCount
              ? `${training.exerciseCount} 个动作`
              : "今天还没有安排动作"
            : state === "in_progress"
              ? `训练中 · ${training.elapsedMinutes} 分钟`
              : state === "completed"
                ? "今日训练已完成"
                : "仅当日可撤销,状态将回到未开始";

  const action: ReactNode =
    state === "no_cycle" ? (
      <Button size="sm" asChild>
        <Link href="/workout">创建周期</Link>
      </Button>
    ) : state === "missed" ? (
      <Button size="sm" variant="outline" onClick={undo} disabled={undoing}>
        {undoing ? "撤销中…" : "撤销未完成"}
      </Button>
    ) : state === "not_started" || state === "in_progress" ? (
      <Button size="sm" asChild>
        <Link href="/workout">{state === "in_progress" ? "继续训练" : "开始训练"}</Link>
      </Button>
    ) : (
      <Button size="sm" variant="outline" asChild>
        <Link href="/workout">
          {state === "completed" ? "查看总结" : "查看计划"}
        </Link>
      </Button>
    );

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <CardIcon>
          <Dumbbell className="size-5" />
        </CardIcon>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{title}</span>
            {badge && <span aria-hidden="true">{badge}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- 营养卡 ---------------------------------- */

function NutritionCard({ nutrition }: { nutrition: DashboardData["nutrition"] }) {
  const { kcal, protein, carbs, fat } = nutrition;
  const p = pct(kcal.current, kcal.goal);
  const over = p != null && p > 100;
  const empty = kcal.current === 0;

  const macros = [
    { label: "蛋白", stat: protein },
    { label: "碳水", stat: carbs },
    { label: "脂肪", stat: fat },
  ] as const;

  return (
    <Link href="/diet" className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CardIcon>
              <Flame className="size-5" />
            </CardIcon>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  {kcal.current} / {kcal.goal ?? "--"} kcal
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{p ?? "--"}%</span>
              </div>
              <Bar current={kcal.current} goal={kcal.goal} />
              {over ? (
                <p className={cn("text-xs", OVER_TEXT)}>今日热量已超过目标</p>
              ) : empty ? (
                <p className="text-xs text-muted-foreground">今天还没有记录饮食,点击添加第一餐</p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {macros.map(({ label, stat }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs tabular-nums">
                    {stat.current}/{stat.goal ?? "--"}g
                  </span>
                </div>
                <Bar current={stat.current} goal={stat.goal} className="h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* --------------------------------- 饮水卡 ---------------------------------- */

export function WaterCard({ water }: { water: DashboardData["water"] }) {
  const router = useRouter();
  const [total, setTotal] = useState(water.currentMl);
  // 服务端数据变化(refresh 后)同步本地乐观值(渲染期调整,替代 effect 内 setState)
  const [lastServerMl, setLastServerMl] = useState(water.currentMl);
  if (water.currentMl !== lastServerMl) {
    setLastServerMl(water.currentMl);
    setTotal(water.currentMl);
  }

  const p = pct(total, water.goalMl);
  const over = p != null && p > 100;
  const empty = total === 0;

  async function add(ml: number) {
    setTotal((t) => t + ml); // 乐观更新(3.7.9:1 秒内)
    try {
      const res = await fetch("/api/water-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl: ml }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setTotal((t) => t - ml);
      toast.error("记录失败,请重试");
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <WaterRing current={total} goal={water.goalMl} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold tabular-nums">
            {total} / {water.goalMl ?? "--"} ml
          </p>
          {over ? (
            <p className={cn("text-xs", OVER_TEXT)}>已超过今日饮水目标</p>
          ) : empty ? (
            <p className="text-xs text-muted-foreground">今天还没有记录饮水</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Droplets className="mr-0.5 inline size-3" aria-hidden="true" />
              距目标还差 {Math.max(0, (water.goalMl ?? 0) - total)} ml
            </p>
          )}
          <div className="mt-1.5 flex gap-2">
            {[100, 250, 500].map((ml) => (
              <Button key={ml} variant="outline" size="sm" onClick={() => void add(ml)}>
                +{ml}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- 补剂卡 ---------------------------------- */

export function SupplementCard({ supplements }: { supplements: DashboardData["supplements"] }) {
  const router = useRouter();
  const { list, todayCount, targetCount } = supplements;

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const [dose, setDose] = useState(list[0] ? String(Number(list[0].dose)) : "");
  const [saving, setSaving] = useState(false);
  // 服务端列表变化(refresh 后)重置默认选中(渲染期调整,替代 effect 内 setState)
  const [lastList, setLastList] = useState(list);
  if (list !== lastList) {
    setLastList(list);
    setSelectedId(list[0]?.id ?? null);
    setDose(list[0] ? String(Number(list[0].dose)) : "");
  }

  const selected = list.find((s) => s.id === selectedId) ?? null;
  const hasTarget = targetCount > 0;
  const reached = hasTarget && todayCount >= targetCount;

  function select(id: string) {
    setSelectedId(id);
    const s = list.find((x) => x.id === id);
    setDose(s ? String(Number(s.dose)) : "");
  }

  async function save() {
    if (!selected) return;
    const d = Number(dose);
    if (!Number.isFinite(d) || d <= 0 || Math.round(d * 10) !== d * 10) {
      toast.error("剂量必须大于 0,最多 1 位小数");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/supplement-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplementId: selected.id, dose: d }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "打卡失败,请重试");
        return;
      }
      toast.success(`已打卡 ${selected.name}`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <CardIcon>
          <Pill className="size-5" />
        </CardIcon>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium">
            {list.length === 0
              ? "还没有补剂"
              : hasTarget
                ? `今日补剂打卡 ${todayCount}/${targetCount}`
                : `已打卡 ${todayCount} 次`}
          </p>
          <p className="text-xs text-muted-foreground">
            {list.length === 0
              ? "到饮食页添加第一个补剂"
              : reached
                ? "目标达成 ✓"
                : todayCount === 0
                  ? "今天还没有记录补剂"
                  : "允许超额打卡"}
          </p>
        </div>
        {list.length > 0 ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            打卡
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href="/diet">去添加</Link>
          </Button>
        )}
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>补剂打卡</SheetTitle>
            <SheetDescription>选择补剂并确认单次剂量</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s.id)}
                aria-pressed={selectedId === s.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selectedId === s.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span>{s.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Number(s.dose)}
                  {unitLabel(s.unit)}
                </span>
              </button>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Label htmlFor="supplement-dose">
                剂量{selected ? `(${unitLabel(selected.unit)})` : ""}
              </Label>
              <Input
                id="supplement-dose"
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                value={dose}
                onChange={(e) => setDose(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

/* --------------------------------- 体重卡 ---------------------------------- */

function WeightCard({ weight }: { weight: DashboardData["weight"] }) {
  const router = useRouter();
  const { latestKg, latestDate, deltaKg } = weight;

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  async function submit(overwrite: boolean): Promise<void> {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 20 || v > 300 || Math.round(v * 10) !== v * 10) {
      toast.error("请输入 20~300 之间的体重(最多 1 位小数)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/body-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: v, overwrite }),
      });
      if (res.status === 409) {
        setConfirmOverwrite(true); // 同日覆盖确认(3.2.6)
        return;
      }
      if (!res.ok) {
        toast.error("保存失败,请重试");
        return;
      }
      toast.success("体重已记录");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSaving(false);
    }
  }

  const deltaText =
    deltaKg == null
      ? ""
      : deltaKg === 0
        ? " · 与上次持平"
        : ` · 比上次 ${deltaKg > 0 ? "↑" : "↓"}${Math.abs(deltaKg).toFixed(1)}kg`;

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <CardIcon>
          <Scale className="size-5" />
        </CardIcon>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {latestKg == null ? (
            <>
              <p className="font-medium">暂无体重记录</p>
              <p className="text-xs text-muted-foreground">记录体重,追踪变化趋势</p>
            </>
          ) : (
            <>
              <p className="font-medium tabular-nums">最新体重 {Number(latestKg).toFixed(1)}kg</p>
              <p className="text-xs text-muted-foreground">
                {formatDateLabel(latestDate!)}
                {deltaText}
              </p>
            </>
          )}
        </div>
        <Button
          size="sm"
          variant={latestKg == null ? "default" : "outline"}
          onClick={() => {
            setValue(latestKg != null ? String(Number(latestKg)) : "");
            setOpen(true);
          }}
        >
          {latestKg == null ? "立即记录" : "记录"}
        </Button>
      </CardContent>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o && latestKg != null) setValue(String(Number(latestKg)));
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>记录体重</SheetTitle>
            <SheetDescription>同日重复记录需确认后覆盖</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-input">今日体重(kg)</Label>
            <Input
              id="weight-input"
              type="number"
              inputMode="decimal"
              min={20}
              max={300}
              step={0.1}
              placeholder="20~300"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button onClick={() => void submit(false)} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>今天已经记录过体重</AlertDialogTitle>
            <AlertDialogDescription>是否覆盖今天的记录?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submit(true)}>覆盖</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
