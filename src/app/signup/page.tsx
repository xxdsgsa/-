"use client";

/**
 * 注册页(PRD 3.6.3):邮箱 → 验证码 → 密码 → 协议 → 创建账号
 *
 * 流程:check-email 预检 → 发码(sign-in type,60s 冷却)→
 * signIn.emailOtp 建号(emailVerified=true + 会话)→ setPassword 设密码
 * 开发期验证码在服务端终端输出(console)。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // ≥8 位,含字母和数字

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
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
      const res = await fetch(
        `/api/auth/check-email?email=${encodeURIComponent(email)}`,
      );
      const json = await res.json();
      if (json?.data?.exists) {
        toast.error("该邮箱已注册,请登录", {
          action: { label: "去登录", onClick: () => router.push("/login") },
        });
        return;
      }

      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in", // 注册发码:对未注册邮箱也发送
      });
      if (error) {
        toast.error(
          error.code === "TOO_MANY_ATTEMPTS"
            ? "发送过于频繁,请明日再试"
            : "验证码发送失败,请稍后再试",
        );
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
    if (!/^\d{6}$/.test(otp)) return toast.error("请输入 6 位数字验证码");
    if (!PASSWORD_RE.test(password))
      return toast.error("密码需至少 8 位,且包含字母和数字");
    if (password !== confirmPassword) return toast.error("两次输入的密码不一致");
    if (!agreed) return;

    setSubmitting(true);
    try {
      // 1. OTP 建号(不存在则创建,emailVerified=true)并建立会话
      const { error: signInError } = await authClient.signIn.emailOtp({
        email,
        otp,
        name: "FitMate 用户", // 默认昵称(PRD 3.6.7)
      });
      if (signInError) {
        toast.error(
          signInError.code === "INVALID_OTP" || signInError.code === "OTP_EXPIRED"
            ? "验证码错误或已过期"
            : "注册失败,请稍后再试",
        );
        return;
      }

      // 2. 设置密码
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!res.ok) {
        toast.error("账号已创建但密码设置失败,请通过忘记密码重设");
        router.push("/login");
        return;
      }

      toast.success("注册成功");
      router.push("/onboarding"); // 首次必未完成设置
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
          <CardTitle className="text-2xl">创建账号</CardTitle>
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
              <Label htmlFor="password">密码</Label>
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
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span>
                我已阅读并同意{" "}
                <Link href="/agreement" className="underline underline-offset-2">
                  用户协议
                </Link>{" "}
                和{" "}
                <Link href="/privacy" className="underline underline-offset-2">
                  隐私政策
                </Link>
              </span>
            </label>

            <Button type="submit" size="lg" disabled={!agreed || submitting}>
              {submitting ? "注册中…" : "注册"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            已有账号?{" "}
            <Link href="/login" className="underline underline-offset-2">
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
