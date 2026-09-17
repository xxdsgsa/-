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

/** UTC+8 当前小时(0~23,首页问候语用) */
export function serverHour(): number {
  return new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
}

/** "2026-09-17" → "9月17日"(纯展示函数,无时区语义) */
export function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}月${Number(d)}日`;
}
