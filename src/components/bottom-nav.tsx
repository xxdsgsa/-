"use client";

/**
 * 底部导航(PRD 2.3.2):5 Tab,当前页高亮
 * 补剂/饮水不进导航,以饮食页快捷卡片呈现(2.3.2 决策)。
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { ChartColumn, Dumbbell, Home, User, Utensils } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "首页", icon: Home },
  { href: "/workout", label: "训练", icon: Dumbbell },
  { href: "/diet", label: "饮食", icon: Utensils },
  { href: "/stats", label: "数据", icon: ChartColumn },
  { href: "/profile", label: "我的", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur">
      <div className="mx-auto grid w-full max-w-sm grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
