/**
 * 训练执行页(PRD 3.1.10 / WORKOUT-011):/workout/execute?training=
 *
 * 开始训练 → 逐组记录 → 完成训练。二级页(无底部 Tab)。
 * RSC 只做鉴权 + 执行视图;交互在客户端组件(计时/逐组/休息倒计时)。
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getExecutionView } from "@/lib/db/queries/training-sessions";

import { ExecuteClient } from "./execute-client";

export default async function ExecutePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const sp = await searchParams;
  const trainingId = typeof sp.training === "string" ? sp.training : "";
  if (!/^[0-9a-f-]{36}$/.test(trainingId)) notFound();

  const view = await getExecutionView(session.user.id, trainingId);
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <ExecuteClient view={view} />
    </main>
  );
}
