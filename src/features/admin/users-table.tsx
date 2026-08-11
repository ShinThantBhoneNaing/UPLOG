"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { cn, formatDate } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/database";
import { adminUpdateUser } from "./actions";

const ROLES: UserRole[] = ["admin", "manager", "member"];

export function UsersTable({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  function run(action: Parameters<typeof adminUpdateUser>[0], success?: string) {
    startTransition(async () => {
      const result = await adminUpdateUser(action);
      if (result.ok) {
        if (success) toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function openEdit(u: Profile) {
    setEditing(u);
    setFullName(u.full_name);
    setJobTitle(u.job_title ?? "");
    setDepartment(u.department ?? "");
  }

  function saveEdit() {
    if (!editing) return;
    run(
      {
        id: editing.id,
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim() || null,
        department: department.trim() || null,
      },
      "User updated"
    );
    setEditing(null);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-10" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow
                key={u.id}
                className={cn(!u.is_active && "opacity-60")}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {u.full_name}
                        {u.id === currentUserId && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(v) =>
                      v && v !== u.role &&
                      run({ id: u.id, role: v as UserRole }, "Role updated")
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-28 capitalize"
                      disabled={pending || u.id === currentUserId}
                      aria-label={`Role for ${u.full_name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {u.department ?? "—"}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {formatDate(u.created_at)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={u.is_active}
                    disabled={pending || u.id === currentUserId}
                    onCheckedChange={(checked) =>
                      run(
                        { id: u.id, isActive: checked === true },
                        checked ? "User enabled" : "User disabled"
                      )
                    }
                    aria-label={`${u.is_active ? "Disable" : "Enable"} ${u.full_name}`}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(u)}
                    aria-label={`Edit ${u.full_name}`}
                  >
                    <Pencil aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full name</Label>
              <Input
                id="edit-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Job title</Label>
              <Input
                id="edit-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={pending || !fullName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
