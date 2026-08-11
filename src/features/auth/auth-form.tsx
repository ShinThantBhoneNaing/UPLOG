"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthState } from "./actions";

/**
 * Shared chrome for all auth forms: heading, error/success feedback,
 * pending-state submit button.
 */
export function AuthForm({
  title,
  subtitle,
  action,
  submitLabel,
  children,
  footer,
  hiddenFields,
}: {
  title: string;
  subtitle: string;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    { error: null }
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

      <form action={formAction} className="mt-8 space-y-4" noValidate>
        {hiddenFields &&
          Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

        {children}

        {state.error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            role="status"
            className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          >
            {state.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </form>

      {footer && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
