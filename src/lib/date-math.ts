/**
 * 日期数学工具(纯函数,供 stats / training / 测试用)
 *
 * 单独成文件避免 stats.ts 顶层 import 触发 db 初始化
 */

/** yyyy-mm-dd → Date(UTC 锚点,避免本地时区干扰) */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 加减天数(字符串序,避免夏令时/闰秒问题) */
export function addDays(dateStr: string, n: number): string {
  const d = parseYmd(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** 闭区间日期序列(字符串序) */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
