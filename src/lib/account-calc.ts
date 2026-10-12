/**
 * 注销冷静期纯函数(PRD 3.6.8)
 *
 * 抽离时间计算以便单元测试(避免 db 依赖)
 */

/** PRD 3.6.8 冷静期:15 天 */
export const DELETION_COOLING_DAYS = 15;

/** ms → 天(向上取整) */
function msToDays(ms: number): number {
  return ms / (24 * 60 * 60 * 1000);
}

/**
 * 计算冷静期剩余天数
 *
 * @param requestedAt 申请注销时刻
 * @param now 参照时间(默认 Date.now)
 * @returns 剩余天数;=0 表示今天到期;<0 表示已超期
 */
export function calcCoolingRemaining(
  requestedAt: Date,
  now: number = Date.now(),
): number {
  const elapsedDays = msToDays(now - requestedAt.getTime());
  return Math.ceil(DELETION_COOLING_DAYS - elapsedDays);
}

/** 是否已超期(可物理删除) */
export function isCoolingExpired(
  requestedAt: Date,
  now: number = Date.now(),
): boolean {
  return calcCoolingRemaining(requestedAt, now) < 0;
}
