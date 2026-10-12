"use client";

/**
 * 注销冷静期提示弹窗(PRD 3.6.8)
 *
 * - 登录后(由 (tabs)/layout.tsx 拉取 deletionRequestedAt 渲染)
 * - 不可关闭:只有一个"取消注销"按钮(走 /api/account/deletion DELETE)
 * - 二次确认:避免误触(从 15 天冷静期撤销是大事)
 * - 备选:继续退出登录(走 signOut,让用户保留冷静期状态)
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
import { authClient } from "@/lib/auth-client";

interface Props {
  remainingDays: number;
}

export function CoolingAlert({ remainingDays }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [exiting, setExiting] = useState(false);

  async function cancelDeletion() {
    setWorking(true);
    try {
      const res = await fetch("/api/account/deletion", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "取消失败");
        return;
      }
      toast.success("已取消注销,欢迎回来");
      setConfirmOpen(false);
      // 取消后整页 reload(layout 重新评估删除状态)
      router.refresh();
    } catch {
      toast.error("网络异常,请重试");
    } finally {
      setWorking(false);
    }
  }

  async function exitAndKeep() {
    setExiting(true);
    try {
      await authClient.signOut();
      router.push("/welcome");
    } catch {
      toast.error("退出失败,请重试");
      setExiting(false);
    }
  }

  return (
    <>
      {/* 不可关闭的全屏弹窗(没有 onOpenChange,只能走按钮) */}
      <AlertDialog open={true}>
        <AlertDialogContent size="sm" className="border-orange-300">
          <AlertDialogHeader>
            <AlertDialogTitle>账号正在注销冷静期</AlertDialogTitle>
            <AlertDialogDescription>
              您的账号将在 <strong>{remainingDays}</strong> 天后永久删除
              <br />
              在此期间可取消注销
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={working}
              onClick={() => setConfirmOpen(true)}
            >
              取消注销
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={exiting}
              onClick={() => void exitAndKeep()}
            >
              {exiting ? "退出中…" : "继续退出登录"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* 二次确认:避免误触(15 天冷静期撤销 = 撤销数据销毁) */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消注销?</AlertDialogTitle>
            <AlertDialogDescription>
              取消后账号将恢复正常使用,所有数据保留
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再想想</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void cancelDeletion();
              }}
              disabled={working}
            >
              {working ? "处理中…" : "确认取消注销"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
