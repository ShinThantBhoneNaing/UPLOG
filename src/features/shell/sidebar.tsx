"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { MAIN_NAV, SECONDARY_NAV, visibleFor, type NavItem } from "./nav-config";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
        )}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" aria-label="UPLOG dashboard">
          <Logo
            ink="var(--color-sidebar-accent-foreground)"
            textClassName="text-base text-sidebar-accent-foreground"
            markClassName="size-6"
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {visibleFor(MAIN_NAV, role).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <div className="my-3 border-t border-sidebar-border" />

        {visibleFor(SECONDARY_NAV, role).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
    </aside>
  );
}
