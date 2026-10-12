/**
 * API 路由路径/查询参数解析 helper(Batch 5 refactor)
 *
 * 提供:
 * - DATE_RE 常量:YYYY-MM-DD 正则,跨域统一(已确认 13 路由 + diet/items 内联共 14 处使用)
 * - parseUuidParam:UUID 路径参数校验,失败返回 400 + 文案"参数不合法"
 * - parseDateParam:YYYY-MM-DD 路径参数校验,失败返回 400 + 文案"日期不合法"
 *
 * 适用:
 * - parseUuidParam 用于所有 /api 路由(单段 id 路径参数)
 * - parseDateParam 用于所有 /api 路由(单段 date 路径参数)
 * - DATE_RE 用于 Zod schema(z.string().regex(DATE_RE))和 query string 直接校验
 *
 * 行为:失败统一 400 VALIDATION_ERROR,响应体与现有 14 路由 100% 一致。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

/** YYYY-MM-DD 严格匹配 — 用于补记窗口/路径参数/查询参数 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** UUID v1-v5 任意版本 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<Record<string, string>> };

type ParseResult =
  | { value: string; error: null }
  | { value: null; error: NextResponse };

/**
 * 解析 ctx.params 中的 UUID id,失败返回 400 VALIDATION_ERROR(默认文案"参数不合法")。
 * 适用所有路由(单段 id 路径参数)。
 */
export async function parseUuidParam(
  ctx: Ctx,
  paramName = "id",
  errorMessage = "参数不合法",
): Promise<ParseResult> {
  const params = await ctx.params;
  const value = params[paramName];
  if (!value || !UUID_RE.test(value)) {
    return {
      value: null,
      error: NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: errorMessage } },
        { status: 400 },
      ),
    };
  }
  return { value, error: null };
}

/**
 * 解析 ctx.params 中的 YYYY-MM-DD date,失败返回 400 VALIDATION_ERROR(默认文案"日期不合法")。
 * 适用所有路由(单段 date 路径参数)。
 */
export async function parseDateParam(
  ctx: Ctx,
  paramName = "date",
  errorMessage = "日期不合法",
): Promise<ParseResult> {
  const params = await ctx.params;
  const value = params[paramName];
  if (!value || !z.string().regex(DATE_RE).safeParse(value).success) {
    return {
      value: null,
      error: NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: errorMessage } },
        { status: 400 },
      ),
    };
  }
  return { value, error: null };
}
