"use client";

/**
 * 退出登录按钮(PRD 3.6.8):确认后退出并回欢迎页
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (!window.confirm("确定退出登录吗?")) return; // TODO(ui): 换 AlertDialog
    setLoading(true);
    try {
      await authClient.signOut();
      toast.success("已退出登录");
      router.push("/welcome");
    } catch {
      toast.error("退出失败,请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="lg" onClick={handleSignOut} disabled={loading}>
      {loading ? "退出中…" : "退出登录"}
    </Button>
  );
}
