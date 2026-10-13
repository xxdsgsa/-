"use client";
/**
 * 子路由级 Error Boundary
 * Next.js 要求:必须是 "use client",且接收 error/reset 两个 props。
 *
 * 触发场景:路由段内任意 client/server 组件 throw
 * 兜底原则:不要假定 Drizzle / auth 可用,只展示静态文案。
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    // 上线后接 Sentry(任务 6),此处先 console
    console.error("[app:error]", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        !
      </div>
      <div>
        <h1 className="text-xl font-semibold">出错了</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          页面遇到意外,你可以重试,或返回首页继续使用。
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground/60">错误码:{error.digest}</p>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button onClick={reset}>重试</Button>
        <Button variant="outline" onClick={() => router.push("/")}>
          返回首页
        </Button>
      </div>
    </main>
  );
}
