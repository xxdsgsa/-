/**
 * Better Auth 客户端(浏览器侧)
 *
 * 用法:authClient.signIn.email({...}) / authClient.signOut() 等
 * Session 自动走 HttpOnly Cookie(红线:任何 Token/用户信息禁止写入 localStorage)
 * inferAdditionalFields:把服务端 user.additionalFields(onboardedAt)类型带入客户端
 */
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), inferAdditionalFields<typeof auth>()],
});
