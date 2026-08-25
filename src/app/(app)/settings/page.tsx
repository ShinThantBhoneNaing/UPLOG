import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  AppearanceForm,
  PasswordForm,
  ProfileForm,
} from "@/features/settings/settings-forms";
import { ColorsForm } from "@/features/settings/colors-form";
import { IconsForm } from "@/features/settings/icons-form";
import { FaviconForm } from "@/features/settings/favicon-form";
import { getCurrentProfile } from "@/features/shell/get-current-profile";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, security and appearance."
      />
      <div className="space-y-8">
        <section aria-label="Profile">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Profile
          </h2>
          <ProfileForm profile={profile} />
        </section>
        <section aria-label="Appearance" id="appearance">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Appearance
          </h2>
          <div className="space-y-4">
            <AppearanceForm />
            <ColorsForm />
            <IconsForm />
            <FaviconForm />
          </div>
        </section>
        <section aria-label="Security">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Security
          </h2>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}
