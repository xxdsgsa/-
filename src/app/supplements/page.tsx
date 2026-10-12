/**
 * 补剂管理页(PRD 3.9.2):/supplements
 * 我的补剂列表(名称 + 单位 + 单次剂量 + 每日目标 + 今日打卡次数)+【+ 添加补剂】。
 * RSC 直出列表;交互在客户端组件(添加/编辑/删除二次确认)。
 */
import { ArrowLeft, Plus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { serverToday } from "@/lib/date";
import { getTodaySupplementCount, listSupplements } from "@/lib/db/queries/supplements";

import { SupplementManager } from "./supplements-client";

export default async function SupplementsPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const today = serverToday();
  const [list, todayCount] = await Promise.all([
    listSupplements(session.user.id),
    getTodaySupplementCount(session.user.id, today),
  ]);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild aria-label="返回">
          <Link href="/diet">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="flex-1 text-xl font-bold">补剂管理</h1>
        <Button size="sm" asChild>
          <Link href="/supplements/new">
            <Plus className="size-4" />
            添加
          </Link>
        </Button>
      </div>
      <SupplementManager initialList={list} todayCount={todayCount} />
    </main>
  );
}
