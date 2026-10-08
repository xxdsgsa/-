/**
 * /api/diet/items/[id] —— 饮食条目改删(PRD 3.8.5 / NUTRITION-003)
 * PATCH  改重量(读取时按快照重算营养;超 7 天窗口只读)
 * DELETE 删条目,删除后统计重算
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { dietError } from "@/lib/api-diet";
import { deleteDietItem, updateDietItem } from "@/lib/db/queries/diet";

const UUID_RE = /^[0-9a-f-]{36}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const grams = z
  .number()
  .min(1)
  .max(5000)
  .refine((v) => Math.round(v * 10) === v * 10, "最多 1 位小数");

const bodySchema = z.object({
  grams,
  today: z.string().regex(DATE_RE).optional(),
});

async function session() {
  return auth.api.getSession({ headers: await headers() }).catch(() => null);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "请输入 1~5000 之间的数值" } },
      { status: 400 },
    );
  }

  const r = await updateDietItem({
    userId: s.user.id,
    itemId: id,
    grams: parsed.data.grams,
    today: parsed.data.today,
  });
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const today = req.nextUrl.searchParams.get("today") ?? undefined;
  const r = await deleteDietItem({ userId: s.user.id, itemId: id, today });
  if (!r.ok) return dietError(r.reason);
  return NextResponse.json({ success: true, data: null });
}
