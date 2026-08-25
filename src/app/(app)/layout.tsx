import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { CommandSearch } from "@/features/shell/command-search";
import { MobileNav } from "@/features/shell/mobile-nav";
import { NotificationsBell } from "@/features/shell/notifications-bell";
import { Sidebar } from "@/features/shell/sidebar";
import { UserMenu } from "@/features/shell/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-dvh">
      <Sidebar role={profile.role} />

      <div className="lg:pl-16">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <CommandSearch />
          <div className="flex items-center gap-1.5">
            <NotificationsBell userId={profile.id} />
            <UserMenu profile={profile} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav role={profile.role} />
    </div>
  );
}
