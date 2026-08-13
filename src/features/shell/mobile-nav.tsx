"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { MOBILE_NAV, visibleFor } from "./nav-config";

/** Bottom navigation bar, mobile only. */
export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = visibleFor(MOBILE_NAV, role);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
    >
      <div
        className="grid h-16 pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
