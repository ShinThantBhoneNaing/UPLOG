import { Logo, LogoMark } from "@/components/brand/logo";
import { CheckCircle2, TrendingUp, Users } from "lucide-react";

const POINTS = [
  { icon: CheckCircle2, text: "Plan — create and track tasks in seconds" },
  { icon: Users, text: "Share — see what your team is working on" },
  { icon: TrendingUp, text: "Get things done — with a full history of your work" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[5fr_4fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo
          ink="var(--color-sidebar-accent-foreground)"
          textClassName="text-sidebar-accent-foreground"
        />
        <div className="max-w-md">
          <LogoMark className="mb-8 size-16" ink="var(--color-sidebar-accent-foreground)" />
          <h1 className="text-3xl font-semibold leading-tight text-sidebar-accent-foreground">
            See the work.
            <br />
            Track the progress.
            <br />
            <span className="text-primary">Build together.</span>
          </h1>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          UPLOG — Plan. Share. Get things done.
        </p>
        {/* Decorative arrow glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl"
        />
      </div>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
