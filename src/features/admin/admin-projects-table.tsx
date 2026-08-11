"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateProject } from "@/features/projects/actions";
import { formatDate } from "@/lib/utils";
import type { Project, ProfileLite } from "@/types/database";

export function AdminProjectsTable({
  projects,
}: {
  projects: (Project & { owner: ProfileLite | null })[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setArchived(p: Project, archived: boolean) {
    startTransition(async () => {
      const result = await updateProject({
        id: p.id,
        status: archived ? "archived" : "active",
      });
      if (result.ok) {
        toast.success(archived ? "Project archived" : "Project restored");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-48">Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Owner</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="w-28" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {p.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {p.owner?.full_name ?? "—"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {formatDate(p.created_at)}
              </TableCell>
              <TableCell>
                {p.status === "archived" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setArchived(p, false)}
                  >
                    <ArchiveRestore aria-hidden /> Restore
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setArchived(p, true)}
                  >
                    <Archive aria-hidden /> Archive
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
