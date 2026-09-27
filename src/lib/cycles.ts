/**
 * 训练周期展示纯函数(PRD 3.1)——周数与日期区间文案
 */

/** 周期跨周数:含首尾天,不足 7 天按 1 周计 */
export function cycleWeeks(startDate: string, endDate: string): number {
  const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000 + 1;
  return Math.max(1, Math.ceil(days / 7));
}

/** "2026-09-27 ~ 2026-11-27" → "9月27日 ~ 11月27日";跨年时补年份 */
export function formatDateRange(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (sy === ey) return `${sm}月${sd}日 ~ ${em}月${ed}日`;
  return `${sy}年${sm}月${sd}日 ~ ${ey}年${em}月${ed}日`;
}
