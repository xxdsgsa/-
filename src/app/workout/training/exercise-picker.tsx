"use client";

/**
 * 动作库选择器(PRD 3.1.6)
 *
 * - 搜索框 + 肌群分类 chips;我的动作在前(带"我的"标记),官方动作在后
 * - ＋新建动作:名称* / 所属肌群* / 备注可选;保存后直接带入参数设置
 * - 打开/搜索变化时拉取(搜索 300ms 防抖)
 */
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/cycles";
import type { ExerciseView } from "@/lib/db/queries/exercises";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exercise: ExerciseView) => void;
}

export function ExercisePicker({ open, onOpenChange, onPick }: Props) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "">("");
  const [list, setList] = useState<ExerciseView[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  // list = 列表模式;create = 新建动作表单(3.1.6)
  const [mode, setMode] = useState<"list" | "create">("list");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup | "">("");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (search) qs.set("search", search);
        if (muscle) qs.set("muscle", muscle);
        const res = await fetch(`/api/exercises?${qs.toString()}`);
        const body = (await res.json().catch(() => null)) as
          | {
              success: boolean;
              data?: { exercises: ExerciseView[] };
              error?: { code: string; message: string };
            }
          | null;
        if (cancelled) return;
        if (res.ok && body?.success && body.data) setList(body.data.exercises);
        else toast.error("动作库加载失败,请重试");
      } catch {
        if (!cancelled) toast.error("网络异常,请检查网络后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search, muscle]);

  function resetCreate() {
    setNewName("");
    setNewGroup("");
    setNewNote("");
  }

  async function handleCreate() {
    if (newName.trim() === "" || newGroup === "" || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          muscleGroup: newGroup,
          note: newNote.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | {
            success: boolean;
            data?: { exercise: ExerciseView };
            error?: { code: string; message: string };
          }
          | null;
      if (!res.ok || !body?.success || !body.data) {
        toast.error(body?.error?.message ?? "保存失败,请重试");
        return;
      }
      toast.success("已加入我的动作");
      const exercise = body.data.exercise;
      onOpenChange(false);
      setMode("list");
      resetCreate();
      onPick(exercise);
    } catch {
      toast.error("网络异常,请检查网络后重试");
    } finally {
      setCreating(false);
    }
  }

  const mine = list.filter((e) => e.owner === "mine");
  const official = list.filter((e) => e.owner === "official");

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setMode("list");
          resetCreate();
        }
        onOpenChange(o);
      }}
    >
      <SheetContent>
        {mode === "list" ? (
          <>
            <SheetHeader>
              <SheetTitle>动作库</SheetTitle>
              <SheetDescription>选择动作后设置组数与次数</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-8">
              {/* 搜索(3.1.6) */}
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索动作…"
                  maxLength={30}
                  className="pl-9"
                  aria-label="搜索动作"
                />
              </div>
              {/* 肌群分类 chips */}
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {(["", ...MUSCLE_GROUPS] as const).map((g) => {
                  const on = muscle === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setMuscle(g as MuscleGroup | "")}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                        on
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {g === "" ? "全部" : g}
                    </button>
                  );
                })}
              </div>
              {/* 列表:我的在前官方在后 */}
              <div className="max-h-[55vh] space-y-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : list.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    没有找到匹配的动作
                  </p>
                ) : (
                  <>
                    {mine.length > 0 && (
                      <>
                        <p className="pt-1 pb-0.5 text-xs font-medium text-muted-foreground">
                          我的动作
                        </p>
                        {mine.map((e) => (
                          <PickerRow key={e.id} exercise={e} onPick={onPick} />
                        ))}
                      </>
                    )}
                    {official.length > 0 && (
                      <>
                        <p className="pt-2 pb-0.5 text-xs font-medium text-muted-foreground">
                          官方动作
                        </p>
                        {official.map((e) => (
                          <PickerRow key={e.id} exercise={e} onPick={onPick} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setMode("create")}>
                <Plus className="size-4" />
                新建动作
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>新建动作</SheetTitle>
              <SheetDescription>保存后加入我的动作,以后可重复使用</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="exercise-name">动作名称</Label>
                <Input
                  id="exercise-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="如:弹力带夹胸"
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label>所属肌群</Label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLE_GROUPS.map((g) => {
                    const on = newGroup === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setNewGroup(g)}
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
              <div className="space-y-2">
                <Label htmlFor="exercise-note">动作备注(可选)</Label>
                <Input
                  id="exercise-note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMode("list");
                    resetCreate();
                  }}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  disabled={creating || newName.trim() === "" || newGroup === ""}
                  onClick={handleCreate}
                >
                  {creating ? "保存中…" : "保存"}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PickerRow({ exercise, onPick }: { exercise: ExerciseView; onPick: (e: ExerciseView) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left active:bg-muted"
      onClick={() => onPick(exercise)}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{exercise.name}</span>
        <span className="block text-xs text-muted-foreground">{exercise.muscleGroup}</span>
      </span>
      <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {exercise.owner === "mine" ? "我的" : "官方"}
      </span>
    </button>
  );
}
