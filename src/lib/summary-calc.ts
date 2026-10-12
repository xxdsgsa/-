/**
 * 训练总结相关纯函数(3.5)
 * 单独成文件避免测试触发 db 初始化
 */

export interface SetLogLite {
  actualWeight: number | null;
  actualReps: number;
  completed: boolean;
}

/**
 * 容量(kg) = Σ 重量 × 次数(仅完成组;无重量按 0,3.5.3 不折算)
 * 全部无重量 → 0(上层判断为 null 展示 "—")
 */
export function calcVolumeFromLogs(logs: SetLogLite[]): number {
  return logs.reduce((sum, l) => {
    if (!l.completed) return sum;
    return sum + (l.actualWeight ?? 0) * l.actualReps;
  }, 0);
}

/** 是否有任何有效重量记录(决定 UI 展示 "—" 还是 "Xkg") */
export function hasAnyWeight(logs: SetLogLite[]): boolean {
  return logs.some((l) => l.completed && l.actualWeight != null && l.actualWeight > 0);
}
