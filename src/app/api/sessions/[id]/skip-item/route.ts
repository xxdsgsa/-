/**
 * POST /api/sessions/:id/skip-item —— 跳过动作(PRD 3.1.10/3.2.7)
 *
 * 该动作剩余未完成组批量生成 completed=false 行(已完成组不动),记"未完成"进入下一动作。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/api/auth";
import { dayError } from "@/lib/api/days";
import { parseJsonBody } from "@/lib/api/parse";
import { parseUuidParam } from "@/lib/api/params";
import { skipItem } from "@/lib/db/queries/training-sessions";

const bodySchema = z.object({
  trainingItemId: z.string().uuid(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { value: id, error: idError } = await parseUuidParam(ctx);
  if (idError) return idError;

  const { data, error: parseError } = await parseJsonBody(req, bodySchema);
  if (parseError) return parseError;

  const result = await skipItem({
    userId,
    sessionId: id,
    trainingItemId: data.trainingItemId,
  });
  if (!result.ok) return dayError(result.reason);

  return NextResponse.json({ success: true, data: null });
}
