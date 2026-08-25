"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
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
      {/* Label fades in when the rail expands on hover/focus. */}
      <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/side:opacity-100 group-focus-within/side:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        // Collapsed icon rail; expands over the content on hover or when a
        // nav link inside has keyboard focus. Content stays at lg:pl-16.
        "group/side fixed inset-y-0 left-0 z-40 hidden w-16 flex-col overflow-x-hidden",
        "border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        "hover:w-60 hover:shadow-xl focus-within:w-60 lg:flex"
      )}
    >
      <div className="flex h-16 shrink-0 items-center px-[22px]">
        <Link
          href="/dashboard"
          aria-label="UPLOG dashboard"
          className="flex items-center gap-2"
        >
          <LogoMark
            className="size-6 shrink-0"
            ink="var(--color-sidebar-accent-foreground)"
          />
          <span className="whitespace-nowrap text-base font-bold tracking-[0.18em] text-sidebar-accent-foreground opacity-0 transition-opacity duration-150 group-hover/side:opacity-100 group-focus-within/side:opacity-100">
            <span className="text-sidebar-primary">UP</span>LOG
          </span>
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
