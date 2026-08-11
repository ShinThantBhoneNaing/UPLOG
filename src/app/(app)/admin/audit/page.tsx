import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import type { AuditLog, ProfileLite } from "@/types/database";

export const metadata: Metadata = { title: "Admin · Audit log" };

const ACTION_LABELS: Record<string, string> = {
  role_changed: "Changed a user's role",
  user_disabled: "Disabled a user",
  user_enabled: "Enabled a user",
  project_archived: "Archived a project",
  workspace_updated: "Updated workspace settings",
};

function describe(log: AuditLog): string {
  const base = ACTION_LABELS[log.action] ?? log.action;
  const d = log.detail;
  if (log.action === "role_changed" && d.user) {
    return `${d.user}: ${d.from} → ${d.to}`;
  }
  if ((log.action === "user_disabled" || log.action === "user_enabled") && d.user) {
    return String(d.user);
  }
  if (log.action === "project_archived" && d.project) {
    return String(d.project);
  }
  if (log.action === "workspace_updated" && d.name) {
    return `Name: ${d.name}`;
  }
  return base;
}

type AuditWithActor = AuditLog & { actor: ProfileLite | null };

export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_id_fkey(id, full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(200)
    .overrideTypes<AuditWithActor[]>();

  if (!logs?.length) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No audit entries yet"
        description="Security-sensitive actions — role changes, disabled users, archived projects — are recorded here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="min-w-48">Detail</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {log.actor ? (
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      name={log.actor.full_name}
                      avatarUrl={log.actor.avatar_url}
                      className="size-6"
                    />
                    <span className="text-sm">{log.actor.full_name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">System</span>
                )}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {ACTION_LABELS[log.action] ?? log.action}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {describe(log)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {relativeTime(log.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
