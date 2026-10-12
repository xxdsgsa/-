/**
 * 补剂服务层(PRD 3.9;首页卡片打卡 3.7.6)
 * 打卡 = 引用 + 快照(删除补剂不影响历史,3.9.2);一天可多次,带时间戳。
 */
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { serverToday } from "@/lib/date";

import { db } from "@/db";
import { supplementLogs, supplements } from "@/db/schema";

/** 当日补剂打卡次数(API 响应/卡片同步用) */
export async function getTodaySupplementCount(userId: string, date: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, date)));
  return row?.n ?? 0;
}

/**
 * 补剂打卡(3.9.3):单条 = 补剂 + 覆盖后的单次剂量(默认该补剂的 dose)。
 * 归属校验(带 user_id + 软删除过滤);快照 name/unit/dose。
 */
export async function addSupplementLog(input: {
  userId: string;
  supplementId: string;
  /** 覆盖剂量;缺省用补剂默认单次剂量 */
  dose?: string;
  date: string;
}): Promise<boolean> {
  const [supplement] = await db
    .select()
    .from(supplements)
    .where(
      and(
        eq(supplements.id, input.supplementId),
        eq(supplements.userId, input.userId),
        isNull(supplements.deletedAt),
      ),
    )
    .limit(1);
  if (!supplement) return false;

  await db.insert(supplementLogs).values({
    userId: input.userId,
    supplementId: supplement.id,
    name: supplement.name,
    unit: supplement.unit,
    dose: input.dose ?? supplement.dose,
    date: input.date,
  });
  return true;
}

/* ============================================================
 * 补剂管理(PRD 3.9.2):增删改查
 * 软删(3.9.2 历史记录保留);编辑/删除均带 user_id 归属校验。
 * ============================================================ */

export const SUPPLEMENT_UNITS = ["scoop", "g", "pill", "tablet", "ml"] as const;
export type SupplementUnit = (typeof SUPPLEMENT_UNITS)[number];

export const SUPPLEMENT_UNIT_LABELS: Record<SupplementUnit, string> = {
  scoop: "勺",
  g: "g",
  pill: "粒",
  tablet: "片",
  ml: "ml",
};

export interface SupplementView {
  id: string;
  name: string;
  unit: SupplementUnit;
  /** numeric 字符串,如 "5.0" */
  dose: string;
  dailyTarget: number | null;
}

export interface SupplementInput {
  name: string;
  unit: SupplementUnit;
  dose: number;
  dailyTarget?: number | null;
}

export async function listSupplements(userId: string): Promise<SupplementView[]> {
  const rows = await db
    .select()
    .from(supplements)
    .where(and(eq(supplements.userId, userId), isNull(supplements.deletedAt)))
    .orderBy(asc(supplements.name));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    unit: s.unit as SupplementUnit,
    dose: s.dose,
    dailyTarget: s.dailyTarget ? Number(s.dailyTarget) : null,
  }));
}

export type SupplementMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "NOT_FOUND" };

export async function createSupplement(
  userId: string,
  body: SupplementInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(supplements)
    .values({
      userId,
      name: body.name,
      unit: body.unit,
      dose: String(body.dose),
      dailyTarget: body.dailyTarget != null ? String(body.dailyTarget) : null,
    })
    .returning({ id: supplements.id });
  return { id: row.id };
}

export async function updateSupplement(
  userId: string,
  id: string,
  body: Partial<SupplementInput>,
): Promise<SupplementMutationResult<null>> {
  const [row] = await db
    .select()
    .from(supplements)
    .where(
      and(eq(supplements.id, id), eq(supplements.userId, userId), isNull(supplements.deletedAt)),
    )
    .limit(1);
  if (!row) return { ok: false, reason: "NOT_FOUND" };

  await db
    .update(supplements)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.dose !== undefined ? { dose: String(body.dose) } : {}),
      ...(body.dailyTarget !== undefined
        ? { dailyTarget: body.dailyTarget != null ? String(body.dailyTarget) : null }
        : {}),
    })
    .where(eq(supplements.id, id));
  return { ok: true, data: null };
}

/** 软删(3.9.2);历史记录走快照不受影响 */
export async function deleteSupplement(
  userId: string,
  id: string,
): Promise<SupplementMutationResult<null>> {
  const [row] = await db
    .select()
    .from(supplements)
    .where(
      and(eq(supplements.id, id), eq(supplements.userId, userId), isNull(supplements.deletedAt)),
    )
    .limit(1);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  await db.update(supplements).set({ deletedAt: new Date() }).where(eq(supplements.id, id));
  return { ok: true, data: null };
}

/** 编辑页读取单条(不存在或已删除 → null) */
export async function findSupplementForEdit(
  userId: string,
  id: string,
): Promise<SupplementView | null> {
  const [row] = await db
    .select()
    .from(supplements)
    .where(
      and(eq(supplements.id, id), eq(supplements.userId, userId), isNull(supplements.deletedAt)),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    unit: row.unit as SupplementUnit,
    dose: row.dose,
    dailyTarget: row.dailyTarget ? Number(row.dailyTarget) : null,
  };
}

/* ============================================================
 * 今日打卡记录(3.9.3):列表 + 单条删除
 * ============================================================ */

export interface SupplementLogView {
  id: string;
  supplementId: string | null;
  name: string;
  unit: SupplementUnit;
  dose: string;
  /** ISO 串,客户端直接 toLocaleTimeString */
  loggedAt: string;
}

export async function listSupplementLogs(
  userId: string,
  date: string,
): Promise<SupplementLogView[]> {
  const rows = await db
    .select()
    .from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, date)))
    .orderBy(desc(supplementLogs.loggedAt), desc(supplementLogs.id));
  return rows.map((r) => ({
    id: r.id,
    supplementId: r.supplementId,
    name: r.name,
    unit: r.unit as SupplementUnit,
    dose: r.dose,
    loggedAt: r.loggedAt.toISOString(),
  }));
}

export async function deleteSupplementLog(
  userId: string,
  logId: string,
  today?: string,
): Promise<SupplementMutationResult<null>> {
  const [row] = await db
    .select()
    .from(supplementLogs)
    .where(and(eq(supplementLogs.id, logId), eq(supplementLogs.userId, userId)))
    .limit(1);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  // 仅当日日志可删(过日让历史不可逆,3.9.5)
  const t = today ?? serverToday();
  if (row.date !== t) return { ok: false, reason: "NOT_FOUND" };
  await db.delete(supplementLogs).where(eq(supplementLogs.id, logId));
  return { ok: true, data: null };
}
