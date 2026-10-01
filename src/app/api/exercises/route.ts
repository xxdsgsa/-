/**
 * /api/exercises —— 动作库(PRD 3.1.6 / TECH 3.3)
 *
 * GET  ?search=&muscle=  官方+我的动作列表(我的在前);搜索名称,筛选肌群
 * POST 新建自定义动作(名称* / 肌群* / 备注可选),保存后加入"我的动作"
 */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { MUSCLE_GROUPS } from "@/lib/cycles";
import { createExercise, listExercises } from "@/lib/db/queries/exercises";

const querySchema = z.object({
  search: z.string().trim().max(30).optional(),
  muscle: z.enum(MUSCLE_GROUPS).optional(),
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(30),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  note: z.string().trim().max(200).optional(),
});

async function session() {
  return auth.api.getSession({ headers: await headers() }).catch(() => null);
}

export async function GET(req: NextRequest) {
  const s = await session();
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    ...(sp.get("search") ? { search: sp.get("search") } : {}),
    ...(sp.get("muscle") ? { muscle: sp.get("muscle") } : {}),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "查询参数不合法" } },
      { status: 400 },
    );
  }

  const exercises = await listExercises(s.user.id, {
    search: parsed.data.search || undefined,
    muscleGroup: parsed.data.muscle,
  });
  return NextResponse.json({ success: true, data: { exercises } });
}

export async function POST(req: NextRequest) {
  const s = await session();
  if (!s) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "表单数据不合法" } },
      { status: 400 },
    );
  }

  const exercise = await createExercise({
    userId: s.user.id,
    name: parsed.data.name,
    muscleGroup: parsed.data.muscleGroup,
    note: parsed.data.note,
  });
  return NextResponse.json(
    {
      success: true,
      data: {
        exercise: {
          id: exercise.id,
          name: exercise.name,
          category: exercise.category,
          muscleGroup: exercise.muscleGroup,
          note: exercise.note,
          owner: "mine" as const,
        },
      },
    },
    { status: 201 },
  );
}
