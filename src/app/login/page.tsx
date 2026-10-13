"use client";

/**
 * 登录页(PRD 3.6.4):邮箱 + 密码;错误不区分哪项;连续失败锁定提示
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { EMAIL_RE } from "@/lib/validators";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return toast.error("请输入正确的邮箱地址");
    if (!password) return toast.error("请输入密码");

    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        if (error.status === 429) {
          toast.error("尝试次数过多,账号已临时锁定,请 15 分钟后重试");
        } else {
          // 不区分邮箱/密码错误(PRD 3.6.4)
          toast.error("邮箱或密码错误");
        }
        return;
      }
      toast.success("登录成功");
      // 跳 /dashboard,由 (tabs)/layout.tsx 守卫统一兜底:
      // - 已完成 onboarding → 留在 /dashboard
      // - 未完成 onboarding → 守卫推回 /onboarding
      // 这样不再依赖 session payload 中 onboardedAt 字段的透传(Batch 1)。
      router.push("/dashboard");
    } catch {
      toast.error("网络异常,请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline underline-offset-2"
                >
                  忘记密码?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "登录中…" : "登录"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            还没有账号?{" "}
            <Link href="/signup" className="underline underline-offset-2">
              去注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
