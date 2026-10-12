/**
 * 事件名 / 类型常量(无 IO,可被测试覆盖)
 * 真正写 db 在 analytics.ts(避免测试触发 db 初始化)
 */
export const EVENT = {
  RECORD_CREATED: "record_created",
  STATS_PAGE_VIEW: "stats_page_view",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

/** 记录类型(供 props.record_type 筛选/聚合) */
export type RecordType =
  | "diet_item"
  | "supplement_checkin"
  | "water_intake"
  | "body_weight"
  | "training_session";
