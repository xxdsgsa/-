"use client";

/**
 * 注销账号按钮(PRD 3.6.8):三段流程
 *
 * 1. 警示弹窗(数据将永久删除) → 发码
 * 2. 验证码输入(60s 冷却 + 每日 5 次,3.6.3)
 * 3. 提交成功后告知冷静期 15 天 + 可在登录时取消(3.6.8 弹窗)
 *
 * 邮件服务未接 Resend,验证码通过 console.log 输出(开发期)。
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "warning" | "otp" | "success";

interface Props {
  /** 受控:父组件可由独立入口触发(我的页 / 登录弹窗) */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeletionButton({ defaultOpen = false, onOpenChange }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<Step>("warning");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<{ remainingDays: number } | null>(null);

  function handleOpenChange(o: boolean) {
    setOpen(o);
    onOpenChange?.(o);
    if (!o) {
      // 重置状态
      setStep("warning");
      setOtp("");
      setCooldown(0);
      setRemaining(null);
      setResult(null);
    }
  }

  async function sendOtp() {
    if (cooldown > 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/account/deletion/request", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { success: true; data: { cooldownSeconds: number; remainingToday: number } }
        | { success: false; error: { message: string }; data?: { cooldownSeconds?: number } }
        | null;
      if (!res.ok || !body) {
        const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? "发送失败";
        toast.error(msg);
        if (body && "data" in body && body.data?.cooldownSeconds) {
          setCooldown(body.data.cooldownSeconds);
          startCooldown(body.data.cooldownSeconds);
        }
        return;
      }
      if (body.success) {
        toast.success("验证码已发送(开发期见后端控制台)");
        setStep("otp");
        setCooldown(body.data.cooldownSeconds);
        setRemaining(body.data.remainingToday);
        startCooldown(body.data.cooldownSeconds);
      }
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSending(false);
    }
  }

  function startCooldown(s: number) {
    let left = s;
    const id = setInterval(() => {
      left -= 1;
      setCooldown(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
  }

  async function submitOtp() {
    if (!/^\d{6}$/.test(otp)) {
      toast.error("请输入 6 位验证码");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const body = (await res.json().catch(() => null)) as
        | { success: true; data: { remainingDays: number } }
        | { success: false; error: { message: string } }
        | null;
      if (!res.ok || !body) {
        const errMsg = body && "error" in body ? body.error.message : "提交失败";
        toast.error(errMsg);
        return;
      }
      if (body.success) {
        setResult({ remainingDays: body.data.remainingDays });
        setStep("success");
        // 注销申请已提交,不主动跳页 — 用户选择"我知道了"再关弹窗
      }
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => handleOpenChange(true)}
      >
        注销账号
      </Button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent size="sm">
          {step === "warning" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>确定注销账号?</AlertDialogTitle>
                <AlertDialogDescription>
                  所有数据将永久删除且不可恢复
                  <br />
                  注销申请将在 <strong>15 天冷静期</strong> 后生效,期间可登录取消
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>再想想</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    void sendOtp();
                  }}
                  disabled={sending}
                >
                  {sending ? "发送中…" : "继续注销"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {step === "otp" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>输入验证码</AlertDialogTitle>
                <AlertDialogDescription>
                  验证码已发送至注册邮箱(开发期见后端控制台)
                  <br />
                  5 分钟内有效
                  {remaining !== null && ` · 今日剩余 ${remaining} 次`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="deletion-otp">6 位验证码</Label>
                <Input
                  id="deletion-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  placeholder="请输入"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => void sendOtp()}
                    disabled={cooldown > 0 || sending}
                  >
                    {cooldown > 0 ? `${cooldown}s 后重发` : "重新发送"}
                  </Button>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    void submitOtp();
                  }}
                  disabled={submitting || otp.length !== 6}
                >
                  {submitting ? "提交中…" : "提交注销"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {step === "success" && result && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>注销申请已提交</AlertDialogTitle>
                <AlertDialogDescription>
                  您的账号将在 {result.remainingDays} 天后永久删除
                  <br />
                  在此期间登录可取消注销
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction
                  onClick={() => {
                    handleOpenChange(false);
                    router.push("/welcome");
                  }}
                >
                  我知道了
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
