/**
 * 日编辑页(PRD 3.1.5):/workout/day?cycle=&date=
 *
 * 顶部 Week N / 周X;空态【添加训练】【设为休息日】;一天多训练追加制;
 * 历史日期只读。二级页(无底部 Tab),返回训练计划页。
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getDayDetail } from "@/lib/db/queries/training-days";

import { DayEditor } from "./day-editor";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const sp = await searchParams;
  const cycleId = typeof sp.cycle === "string" ? sp.cycle : "";
  const date = typeof sp.date === "string" ? sp.date : "";
  if (!DATE_RE.test(date)) notFound();

  const detail = await getDayDetail(session.user.id, cycleId, date);
  if (!detail) notFound();

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <DayEditor detail={detail} />
    </main>
  );
}
