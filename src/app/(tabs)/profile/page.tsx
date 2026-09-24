/**
 * 我的页(Tab 5,PRD 2.3.1)——骨架:个人资料 + 退出登录
 * 我的目标/设置(饮水目标/协议/注销账号)在后续模块建设;守卫由 (tabs) 布局承担。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login"); // 布局守卫兜底,此处为类型收窄

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-8">
      <h1 className="text-xl font-bold">我的</h1>
      <div className="mt-4 flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="font-medium">{session.user.name}</p>
        <p className="text-sm text-muted-foreground">{session.user.email}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        个人资料、我的目标、设置建设中(PRD 2.3.1)
      </p>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
