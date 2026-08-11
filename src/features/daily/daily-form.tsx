"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveDailyUpdate } from "./actions";

export function DailyForm({
  initialSummary,
  initialTaskIds,
  candidateTasks,
  alreadySaved,
}: {
  initialSummary: string;
  initialTaskIds: string[];
  /** Open/recently-touched tasks assigned to the user. */
  candidateTasks: { id: string; title: string }[];
  alreadySaved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState(initialSummary);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTaskIds));

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await saveDailyUpdate({
        summary,
        taskIds: [...selected],
      });
      if (result.ok) {
        toast.success(alreadySaved ? "Update saved" : "Daily update posted 🎉");
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
      className="rounded-xl border bg-card p-5"
    >
      <Label htmlFor="daily-summary" className="text-base font-semibold">
        What did you work on today?
      </Label>
      <Textarea
        id="daily-summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="e.g. Implemented payment API authentication and fixed the login redirect issue."
        rows={4}
        maxLength={8000}
        className="mt-3"
      />

      {candidateTasks.length > 0 && (
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Tasks worked on</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {candidateTasks.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5"
              >
                <Checkbox
                  checked={selected.has(t.id)}
                  onCheckedChange={(checked) => toggle(t.id, checked === true)}
                  aria-label={t.title}
                />
                <span className="line-clamp-1">{t.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending || !summary.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {alreadySaved ? "Update today's entry" : "Save daily update"}
        </Button>
      </div>
    </form>
  );
}
