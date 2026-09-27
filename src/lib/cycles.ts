/**
 * 训练周期展示纯函数(PRD 3.1)——周数/日期文案/自然周运算
 *
 * 周编号口径:自然周(周一为一周开始),Week1 = 周期开始日期所在周;
 * 周列表(3.1.2)与周期卡"共 N 周"均按此口径,两者对齐。
 */

/** 训练部位(PRD 3.1.5 添加训练,多选) */
export const MUSCLE_GROUPS = ["胸", "背", "肩", "二头", "三头", "腿", "核心"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/* ---- 日期底层运算(YYYY-MM-DD,统一按 UTC 日历,无时区语义) ---- */

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 所在自然周的周一 */
export function weekStartOf(date: string): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return fmt(d);
}

/** date + n 天 */
export function addDays(date: string, n: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** 周期跨周数(自然周):Week1 从开始日期所在周起算 */
export function cycleWeeks(startDate: string, endDate: string): number {
  const days = (toUTC(endDate).getTime() - toUTC(weekStartOf(startDate)).getTime()) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

/** 自然周序号:date 在周期内的第几周(≥1;周期外日期按越界周算,调用方负责夹取) */
export function weekIndexOf(date: string, cycleStart: string): number {
  const days = (toUTC(date).getTime() - toUTC(weekStartOf(cycleStart)).getTime()) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** "2026-09-27" → "周日" */
export function weekdayCN(date: string): string {
  return WEEKDAY_CN[toUTC(date).getUTCDay()];
}

/** "2026-09-27" ~ "2026-11-27" → "9月27日 ~ 11月27日";跨年时补年份 */
export function formatDateRange(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (sy === ey) return `${sm}月${sd}日 ~ ${em}月${ed}日`;
  return `${sy}年${sm}月${sd}日 ~ ${ey}年${em}月${ed}日`;
}
