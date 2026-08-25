"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Camera, Loader2, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { changePassword, updateOwnProfile } from "./actions";

const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AVATAR_MAX = 3 * 1024 * 1024;

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile.full_name);
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  async function uploadAvatar(file: File) {
    if (!AVATAR_TYPES.has(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX) {
      toast.error("Avatar images can be at most 3 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        console.error("[settings] avatar upload failed:", error.message);
        toast.error("We couldn't upload your avatar.");
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new image shows immediately.
      setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
      toast.success("Avatar updated — remember to save.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await updateOwnProfile({
        fullName,
        jobTitle,
        department,
        phone,
        avatarUrl,
      });
      if (result.ok) {
        toast.success("Profile saved");
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
      className="max-w-md space-y-5 rounded-xl border bg-card p-5"
    >
      <div className="flex items-center gap-4">
        <UserAvatar name={fullName || "?"} avatarUrl={avatarUrl} className="size-16" />
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Camera aria-hidden />
            )}
            Change avatar
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPEG or WebP, up to 3 MB.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Upload avatar"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-name">Full name</Label>
        <Input
          id="settings-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-title">Job title</Label>
        <Input
          id="settings-title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Backend Developer"
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-department">Department</Label>
        <Input
          id="settings-department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. Engineering"
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-phone">Phone number</Label>
        <Input
          id="settings-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +95 9 123 456 789"
          maxLength={40}
          autoComplete="tel"
        />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={profile.email} disabled aria-label="Email (read-only)" />
        <p className="text-xs text-muted-foreground">
          Contact an admin to change your email address.
        </p>
      </div>

      <Button type="submit" disabled={pending || !fullName.trim()}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save profile
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function submit() {
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const result = await changePassword({ password });
      if (result.ok) {
        toast.success("Password changed");
        setPassword("");
        setConfirm("");
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
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={pending || password.length < 8}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Change password
      </Button>
    </form>
  );
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Sign out moved here since the top-bar avatar is no longer interactive. */
export function SignOutForm() {
  return (
    <div className="flex max-w-md items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <div>
        <p className="text-sm font-medium">Sign out of UPLOG</p>
        <p className="text-xs text-muted-foreground">
          You can sign back in anytime.
        </p>
      </div>
      <Button variant="outline" onClick={() => void logout()}>
        <LogOut aria-hidden /> Sign out
      </Button>
    </div>
  );
}

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex max-w-md gap-2 rounded-xl border bg-card p-5"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex flex-1 flex-col items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
            theme === value
              ? "border-primary bg-primary/5 text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
