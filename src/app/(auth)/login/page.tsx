import type { Metadata } from "next";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      {error === "expired-link" && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground dark:text-warning"
        >
          That link has expired or was already used. Request a new one below.
        </p>
      )}
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to your UPLOG workspace."
      action={login}
      submitLabel="Sign in"
      hiddenFields={next ? { next } : undefined}
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
    </AuthForm>
    </>
  );
}
