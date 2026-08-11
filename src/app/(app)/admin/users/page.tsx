import type { Metadata } from "next";
import { Info } from "lucide-react";
import { UsersTable } from "@/features/admin/users-table";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const metadata: Metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .overrideTypes<Profile[]>();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          New teammates join by registering at{" "}
          <span className="font-medium text-foreground">/register</span> with
          their work email — their account appears here immediately. Disabling a
          user blocks all access instantly while keeping their work history.
        </p>
      </div>
      <UsersTable users={users ?? []} currentUserId={profile.id} />
    </div>
  );
}
