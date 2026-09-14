import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { OnboardingWizard } from "./wizard";

/**
 * 首次设置(PRD 3.6.6):4 步向导
 * 守卫:未登录 → /login;已完成 → /dashboard(仅首次展示,3.6.9)
 */
export default async function OnboardingPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");
  if (session.user.onboardedAt) redirect("/dashboard");

  return <OnboardingWizard nickname={session.user.name || "FitMate 用户"} />;
}
