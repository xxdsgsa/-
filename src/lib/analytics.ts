/**
 * 服务端埋点(TECH 附录 B,events 表)
 *
 * 口径 1:人均每日记录次数 ≥ 3
 *  = (饮食条目 + 补剂打卡 + 饮水记录 + 体重记录 + 完成训练会话) ÷ DAU,当日
 *  → 触发:各业务 create/upsert 路径记录 record_created
 *
 * 口径 2:数据面板查看率 ≥ 40%
 *  = 访问过 /stats 页的去重用户 ÷ DAU
 *  → 触发:/stats 页面加载时记录 stats_page_view
 *
 * 失败处理:try/catch 静默吞,不影响主流程
 */
import { db } from "@/db";
import { events } from "@/db/schema";

export { EVENT, type EventName, type RecordType } from "@/lib/analytics-types";
import { EVENT, type EventName, type RecordType } from "@/lib/analytics-types";

/**
 * 服务端事件埋点
 *
 * @param userId 当前用户 ID(可空,如未登录场景)
 * @param name 事件名(EVENT.*)
 * @param props 事件附加属性(jsonb)
 */
export async function track(
  userId: string | null,
  name: EventName,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(events).values({
      userId: userId ?? null,
      name,
      props: props ?? null,
    });
  } catch (err) {
    // 埋点失败不影响主流程
    if (process.env.NODE_ENV !== "production") {
      console.warn("[track] failed", { name, err: (err as Error).message });
    }
  }
}

/** 便捷:记录类事件 */
export async function trackRecord(
  userId: string,
  recordType: RecordType,
  extra?: Record<string, unknown>,
): Promise<void> {
  return track(userId, EVENT.RECORD_CREATED, { record_type: recordType, ...extra });
}

/** 便捷:页面访问 */
export async function trackPageView(
  userId: string | null,
  page: string,
): Promise<void> {
  return track(userId, EVENT.STATS_PAGE_VIEW, { page });
}
