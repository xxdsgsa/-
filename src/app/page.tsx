/**
 * 根路由分流:已登录 → 首页;未登录 → 欢迎页(PRD 3.6.1)
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  redirect(session ? "/dashboard" : "/welcome");
}
