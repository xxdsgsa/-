import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isOnboarded } from "@/lib/db/queries/onboarding";
import { OnboardingWizard } from "./wizard";

/**
 * 首次设置(PRD 3.6.6):4 步向导
 * 守卫:登录守卫已由 middleware 统一处理(任务 2);已完成 → /dashboard(仅首次展示,3.6.9)
 */
export default async function OnboardingPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  // middleware 已兜底,此处防御性检查
  if (!session) redirect("/login");
  if (await isOnboarded(session.user.id)) redirect("/dashboard");

  return <OnboardingWizard nickname={session.user.name || "FitMate 用户"} />;
}
