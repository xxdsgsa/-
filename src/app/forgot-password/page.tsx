"use client";

/**
 * 忘记密码页(PRD 3.6.5):邮箱 → 验证码 + 新密码 → 返回登录
 * 全程 Better Auth emailOTP 原生端点(requestPasswordReset / resetPassword)。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { EMAIL_RE, OTP_RE, PASSWORD_RE } from "@/lib/validators";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSendCode() {
    if (!EMAIL_RE.test(email)) {
      toast.error("请输入正确的邮箱地址");
      return;
    }
    setSending(true);
    try {
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email,
      });
      if (error) {
        toast.error("验证码发送失败,请稍后再试");
        return;
      }
      setCooldown(60);
      toast.success("验证码已发送,请查收邮箱(开发期请查看服务端日志)");
    } catch {
      toast.error("网络异常,请稍后再试");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return toast.error("请输入正确的邮箱地址");
    if (!OTP_RE.test(otp)) return toast.error("请输入 6 位数字验证码");
    if (!PASSWORD_RE.test(password))
      return toast.error("密码需至少 8 位,且包含字母和数字");
    if (password !== confirmPassword) return toast.error("两次输入的密码不一致");

    setSubmitting(true);
    try {
      const { error } = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      });
      if (error) {
        toast.error(
          error.code === "INVALID_OTP" || error.code === "OTP_EXPIRED"
            ? "验证码错误或已过期"
            : "重置失败,请稍后再试",
        );
        return;
      }
      toast.success("密码已重置,请使用新密码登录");
      router.push("/login");
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
          <CardTitle className="text-2xl">重置密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">邮箱</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={cooldown > 0 || sending || submitting}
                  onClick={handleSendCode}
                >
                  {cooldown > 0 ? `${cooldown}s` : sending ? "发送中" : "发送验证码"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">验证码</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 位数字"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">新密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少 8 位,含字母和数字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "提交中…" : "重置密码"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            想起密码了?{" "}
            <Link href="/login" className="underline underline-offset-2">
              返回登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
