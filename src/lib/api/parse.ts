/**
 * API 路由层 Zod body 解析与统一 400 响应(Batch 4B refactor)
 *
 * 现状(16 路由):每个 POST/PATCH/DELETE 路由都重复 ~6 行
 *   const parsed = bodySchema.safeParse(await req.json().catch(() => null));
 *   if (!parsed.success) {
 *     return NextResponse.json(
 *       { success: false, error: { code: "VALIDATION_ERROR", message: "..." } },
 *       { status: 400 },
 *     );
 *   }
 *   const { ... } = parsed.data;
 *
 * 重构后:
 *   const { data, error } = await parseJsonBody(req, bodySchema);
 *   if (error) return error;
 *   // ... use data.X
 *
 * 行为零变化:响应体 + status code 与重构前完全一致(代码 + 自定义文案均保留)。
 * catch 行为统一为 `.catch(() => null)`,即使 req.json() 抛错也走 400 VALIDATION_ERROR 而非 500。
 *
 * 设计:
 * - 沿用 requireUserId() 的辨别联合模式({ data, error: null } | { data: null, error: NextResponse }),
 *   保证 ts strict 下 `if (error) return error;` 之后 data 被正确 narrow 为 T。
 * - 文案默认 "表单数据不合法",但允许每个调用方传自己的(errorMessage 参数)— 抽的是样板,
 *   不是文案。已确认 4 路由传自定义 message(diet items/body-weight/water-logs/supplement-logs),
 *   其余 12 路由走默认。
 * - 不导出 query/searchParams 解析版本:GET 路由的 searchParams 模式各不同(空值省略等),
 *   强行抽会引入复杂可选值合并逻辑,得不偿失。/api/auth/check-email 单独保留手写。
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";

export type ParseJsonBodyResult<S extends z.ZodTypeAny> =
  | { data: z.infer<S>; error: null }
  | { data: null; error: NextResponse };

/**
 * API 路由用:解析 JSON body 并 Zod 校验,失败返回 400 VALIDATION_ERROR;成功返回 data(T)。
 * @param req NextRequest
 * @param schema Zod schema — T 由 schema 推断(S extends z.ZodTypeAny + z.infer<S>)
 * @param errorMessage 自定义 400 错误文案;默认 "表单数据不合法"
 * @returns 辨别联合 — 失败时 data:null + error:NextResponse;成功时 data:T + error:null
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
  errorMessage = "表单数据不合法",
): Promise<ParseJsonBodyResult<S>> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return {
      data: null,
      error: NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: errorMessage } },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data, error: null };
}
