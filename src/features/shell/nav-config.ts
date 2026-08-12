import {
  Activity,
  BarChart3,
  CheckSquare,
  FolderKanban,
  History,
  LayoutDashboard,
  NotebookPen,
  Presentation,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/database";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role that sees this item */
  roles?: UserRole[];
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/standup", label: "Standard Meeting", icon: Presentation },
  { href: "/tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/daily", label: "Daily Log", icon: NotebookPen },
  { href: "/team", label: "Team", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/history", label: "History", icon: History },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["manager", "admin"],
  },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Compact set for the mobile bottom bar. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/standup", label: "Meeting", icon: Presentation },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/daily", label: "Daily", icon: NotebookPen },
];

export function visibleFor(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter((i) => !i.roles || i.roles.includes(role));
}
