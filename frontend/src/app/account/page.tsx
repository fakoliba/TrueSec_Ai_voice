"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  changePassword,
  getProfile,
  listPlatformUsers,
  setPlatformUserRole,
  updateProfile,
} from "@/lib/api";
import type { PlatformUser, UserProfile } from "@/lib/api";
import { canManagePlatformUsers } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/lib/utils";

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [platformUsersLoading, setPlatformUsersLoading] = useState(false);
  const [platformUsersError, setPlatformUsersError] = useState("");
  const [updatingRoleForId, setUpdatingRoleForId] = useState<number | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setEmail(p.email);
        setFullName(p.full_name || "");
      })
      .catch((err) => {
        if (err.message === "Not authenticated") {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function loadPlatformUsers() {
    if (!canManagePlatformUsers(profile)) return;
    setPlatformUsersLoading(true);
    setPlatformUsersError("");
    listPlatformUsers()
      .then(setPlatformUsers)
      .catch((err) => setPlatformUsersError(err instanceof Error ? err.message : "Failed to load users"))
      .finally(() => setPlatformUsersLoading(false));
  }

  useEffect(() => {
    if (profile && canManagePlatformUsers(profile)) loadPlatformUsers();
  }, [profile?.id, profile?.role]);

  async function handleRoleChange(userId: number, newRole: string) {
    setUpdatingRoleForId(userId);
    try {
      const updated = await setPlatformUserRole(userId, newRole);
      setPlatformUsers((prev) =>
        prev.map((u) => (u.id === userId ? updated : u))
      );
    } catch (err) {
      setPlatformUsersError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingRoleForId(null);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setProfileMessage("");
    setError("");
    setSavingProfile(true);
    try {
      const updated = await updateProfile({
        email: email.trim() || undefined,
        full_name: fullName.trim() || undefined,
      });
      setProfile(updated);
      setProfileMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage("");
    setError("");

    if (newPassword.length < 6) {
      setPasswordMessage("New password should be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update your profile details and change your password.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClassName}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-medium">{profile.is_active ? "Active" : "Inactive"}</span>
              {" · "}
              Platform role:{" "}
              <span className="font-medium">{profile.role ?? "—"}</span>
            </p>
            {profileMessage && <p className="text-sm text-emerald-600">{profileMessage}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={savingProfile} className="font-semibold">
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Change password</h2>
          <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="current_password"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Current password
              </label>
              <input
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="new_password"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                New password
              </label>
              <input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="confirm_new_password"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Confirm new password
              </label>
              <input
                id="confirm_new_password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            {passwordMessage && <p className="text-sm text-muted-foreground">{passwordMessage}</p>}
            <Button type="submit" disabled={savingPassword} className="font-semibold">
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>

      {canManagePlatformUsers(profile) && (
        <Card className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Manage platform users</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            View and change platform roles (admin / super_admin only). Roles: super_admin, admin, owner, staff, customer.
          </p>
          {platformUsersError && (
            <p className="mt-2 text-sm text-red-600">{platformUsersError}</p>
          )}
          {platformUsersLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading users…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {platformUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border">
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">{u.full_name ?? "—"}</td>
                      <td className="py-2">
                        <select
                          value={u.role ?? ""}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={updatingRoleForId === u.id}
                          className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                        >
                          <option value="super_admin">super_admin</option>
                          <option value="admin">admin</option>
                          <option value="owner">owner</option>
                          <option value="staff">staff</option>
                          <option value="customer">customer</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
