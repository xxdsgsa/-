/**
 * 隐私政策(AUTH-005):V1 占位,正式文本上线前补齐
 */
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-10">
      <h1 className="mb-4 text-2xl font-bold">隐私政策</h1>
      <p className="text-muted-foreground">
        隐私政策正式文本将在上线前更新至此。(AUTH-005)
      </p>
      <Link
        href="/signup"
        className="mt-6 inline-block text-sm underline underline-offset-2"
      >
        返回注册
      </Link>
    </main>
  );
}
