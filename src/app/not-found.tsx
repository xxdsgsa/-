/**
 * 通用 404:不在任何业务流路由下的访问
 * 业务流内自定义 404 由各 page.tsx 自己处理(PRD 无需求)
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-6xl font-bold text-muted-foreground/40">404</p>
      <div>
        <h1 className="text-xl font-semibold">页面不存在</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          链接可能已失效,或你输入的地址有误
        </p>
      </div>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </main>
  );
}
