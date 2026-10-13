/**
 * Tab 结构布局(PRD 2.3.2:首页/训练/饮食/数据/我的)
 * 登录/注册与 onboarding 为进入 Tab 结构前的独立流程(2.3.2)——
 * 本路由组统一守卫:未登录 → /login;未完成首次设置 → /onboarding。
 *
 * 守卫判据:用 DB 侧 isOnboarded() 查询 users.onboarded_at,不再依赖
 * session payload 中 additionalFields 的透传(Batch 1 修复,2026-10-11)。
 * 即便 Better Auth session 不带 onboardedAt 字段,守卫也始终可信。
 *
 * 注销冷静期(3.6.8):layout 拉取 deletionRequestedAt,若在冷静期则渲染
 * 不可关闭的全屏提示弹窗。同时执行 purgeExpiredUsers(15 天过期即物理删除)。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { CoolingAlert } from "@/components/cooling-alert";
import { auth } from "@/lib/auth";
import { getDeletionStatus, purgeExpiredUsers } from "@/lib/db/queries/account";
import { isOnboarded } from "@/lib/db/queries/onboarding";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  // Better Auth 从 cookie 还原 session;失败返回 null。
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  // session 守卫已由 middleware 统一处理(任务 2),此处不再重复 redirect
  // 保留 isOnboarded 检查与注销冷静期逻辑

  // 物理删除:每次 layout 渲染时清理过期的注销申请(15 天前)
  // 安全:仅删 deletionRequestedAt ≤ (now - 15d) 的用户,正常用户不受影响
  await purgeExpiredUsers();

  // middleware 二阶防御:理论上 session 永远非 null,此处仅满足 TS 严格模式
  if (!session) redirect("/login");

  const onboarded = await isOnboarded(session.user.id);
  if (!onboarded) redirect("/onboarding");

  const deletion = await getDeletionStatus(session.user.id);
  const showCooling = deletion.inCooling && (deletion.remainingDays ?? 0) > 0;

  return (
    <div className="min-h-dvh pb-16">
      {children}
      <BottomNav />
      {showCooling && <CoolingAlert remainingDays={deletion.remainingDays ?? 0} />}
    </div>
  );
}
