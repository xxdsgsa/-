/**
 * 编辑补剂页(PRD 3.9.2):/supplements/[id]/edit
 * 字段同新建;读取现有补剂,提交 PATCH。
 */
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { findSupplementForEdit } from "@/lib/db/queries/supplements";

import { SupplementForm } from "../../supplements-form";

type Ctx = { params: Promise<{ id: string }> };

export default async function EditSupplementPage({ params }: Ctx) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const { id } = await params;
  const detail = await findSupplementForEdit(session.user.id, id);
  if (!detail) notFound();

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild aria-label="返回">
          <Link href="/supplements">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">编辑补剂</h1>
      </div>
      <SupplementForm
        mode="edit"
        userId={session.user.id}
        id={detail.id}
        initial={{
          name: detail.name,
          unit: detail.unit,
          dose: Number(detail.dose),
          dailyTarget: detail.dailyTarget,
        }}
      />
    </main>
  );
}
