"use client";

/**
 * 我的页:饮水目标调整入口
 * 触发 WaterGoalForm Sheet。
 */
import { ChevronRight, Droplet } from "lucide-react";
import { useState } from "react";

import { WaterGoalForm } from "@/components/water-goal-form";

interface Props {
  currentMl: number | null;
  manual: boolean;
}

export function ProfileWaterButton({ currentMl, manual }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <Droplet className="size-4 text-muted-foreground" />
          饮水目标
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          {currentMl != null ? `${currentMl} ml` : "未设置"}
          {manual && <span className="text-xs text-orange-500">(已调整)</span>}
          <ChevronRight className="size-4" />
        </span>
      </button>
      <WaterGoalForm
        open={open}
        onOpenChange={setOpen}
        current={currentMl}
        manual={manual}
      />
    </>
  );
}
