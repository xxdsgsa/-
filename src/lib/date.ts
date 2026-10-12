/**
 * 日期工具(服务端"今日"口径,TECH 3.1)
 *
 * ADR-12:客户端设备时区日历日为权威——表单类输入(如 onboarding)由客户端传 today;
 * RSC 首屏与快捷打卡无法感知设备时区,统一用本函数兜底(目标用户均在 UTC+8)。
 */

/** 服务端"今日"(UTC+8 宽松口径):YYYY-MM-DD */
export function serverToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 服务端"昨日"(UTC+8 宽松口径):YYYY-MM-DD
 * 实现:T 减 16h(等价于"今日"起点 16h UTC 再减 24h),跨日边界安全。
 * 错误实现示例 `T + 7h` 在 UTC+8 1:00~8:00 会返回"今日"而非"昨日",勿用。
 */
export function serverYesterday(): string {
  return new Date(Date.now() - 16 * 3600 * 1000).toISOString().slice(0, 10);
}

/** UTC+8 当前小时(0~23,首页问候语用) */
export function serverHour(): number {
  return new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
}

/** "2026-09-17" → "9月17日"(纯展示函数,无时区语义) */
export function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/** 秒 → "58分钟" / "1小时5分钟" / "45秒"(总结页与训练历史共用,PRD 3.5) */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
}
