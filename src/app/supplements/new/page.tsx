/**
 * 新建补剂页(PRD 3.9.2):/supplements/new
 * 字段:名称(1~20)/ 单位(单选) / 单次剂量(>0,1 位小数) / 每日目标(1~10,可选)
 */
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

import { SupplementForm } from "../supplements-form";

export default async function NewSupplementPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild aria-label="返回">
          <Link href="/supplements">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">添加补剂</h1>
      </div>
      <SupplementForm mode="create" />
    </main>
  );
}
