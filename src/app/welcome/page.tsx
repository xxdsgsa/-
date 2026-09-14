/**
 * 欢迎页(PRD 3.6.2):Logo + Slogan + 注册/登录入口 + 协议链接
 * 已登录用户直接进入首页。
 */
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function WelcomePage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-6 py-10">
      <div />

      <div className="flex flex-col items-center gap-4">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Dumbbell className="size-10" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">FitMate</h1>
        <p className="text-center text-muted-foreground">
          训练、饮食、数据,一站式健身伙伴
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/signup">注册</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">登录</Link>
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          注册/登录即代表同意{" "}
          <Link href="/agreement" className="underline underline-offset-2">
            用户协议
          </Link>{" "}
          和{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            隐私政策
          </Link>
        </p>
      </div>
    </main>
  );
}
