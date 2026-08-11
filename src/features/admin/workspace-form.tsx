"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateWorkspace } from "./actions";

export function WorkspaceForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);

  function submit() {
    startTransition(async () => {
      const result = await updateWorkspace({ name });
      if (result.ok) {
        toast.success("Workspace updated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="max-w-md space-y-4 rounded-xl border bg-card p-5"
    >
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
        <p className="text-xs text-muted-foreground">
          Shown across the app and in notifications.
        </p>
      </div>
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save changes
      </Button>
    </form>
  );
}
