import type { Metadata } from "next";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Choose new password" };

export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="Choose a new password"
      subtitle="You're signed in via your reset link — set a new password to finish."
      action={resetPassword}
      submitLabel="Update password"
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          minLength={8}
        />
      </div>
    </AuthForm>
  );
}
