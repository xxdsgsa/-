/**
 * 训练编辑页(PRD 3.1.6/3.1.7):/workout/training?training=
 *
 * 动作编排:动作列表(①②③追加序) + 添加动作(动作库:搜索/分类/新建)
 * + 参数设置(组数/次数/重量/休息/备注) + 上移下移/编辑/复制/删除。
 * 历史日期只读。二级页(无底部 Tab),返回日编辑页。
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getTrainingDetail } from "@/lib/db/queries/training-items";

import { TrainingEditor } from "./training-editor";

export default async function TrainingPage({
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

  const detail = await getTrainingDetail(session.user.id, trainingId);
  if (!detail) notFound();

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <TrainingEditor detail={detail} />
    </main>
  );
}
