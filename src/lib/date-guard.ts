/**
 * 当日撤销的"日期校验"纯函数(3.1.9 / 3.7.3)
 *
 * 服务端:date === serverToday() 才允许撤销;跨日只读
 * 抽到纯函数方便测试 + 客户端/服务端共用
 */
import { serverToday } from "@/lib/date";

/** 该日期是否是"当日"(撤销可用) */
export function isToday(date: string, today: string = serverToday()): boolean {
  return date === today;
}

/** 该日期是否已过"当日"(撤销不可用) */
export function isPastDay(date: string, today: string = serverToday()): boolean {
  return date < today;
}
