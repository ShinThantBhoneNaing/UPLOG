import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { AdminTabs } from "@/features/admin/admin-tabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Manage people, projects and workspace settings."
      />
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
