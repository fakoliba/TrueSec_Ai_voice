"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPlatformUser, getProfile, listPlatformUsers, setPlatformUserRole } from "@/lib/api";
import type { PlatformUser } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/lib/utils";

export default function PlatformUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [updatingRoleForId, setUpdatingRoleForId] = useState<number | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("super_admin");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");

  function loadUsers() {
    setListError("");
    listPlatformUsers()
      .then(setUsers)
      .catch((err) => setListError(err instanceof Error ? err.message : "Failed to load users"));
  }

  useEffect(() => {
    getProfile()
      .then(() => {
        loadUsers();
      })
      .catch((err) => {
        if (err.message === "Not authenticated") router.push("/login");
        else setListError(err instanceof Error ? err.message : "Failed");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleRoleChange(userId: number, newRole: string) {
    setUpdatingRoleForId(userId);
    try {
      const updated = await setPlatformUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingRoleForId(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteMessage("");
    setInviteSubmitting(true);
    try {
      await createPlatformUser({
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || null,
        password: invitePassword,
        role: inviteRole,
      });
      setInviteMessage("User created. They can sign in with the email and password you set.");
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      loadUsers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setInviteSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
          ← Platform
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Platform users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Super users and platform roles. Only a super admin can assign the <code className="text-xs">super_admin</code>{" "}
          role.
        </p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="text-lg font-semibold text-foreground">Invite platform user</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Creates an account with a temporary password. Share credentials securely with the new operator.
        </p>
        <form onSubmit={handleInvite} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">Email *</label>
            <input
              required
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Full name</label>
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Temporary password *</label>
            <input
              required
              type="password"
              minLength={6}
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">Platform role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="super_admin">super_admin (super user)</option>
              <option value="admin">admin</option>
              <option value="customer">customer</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={inviteSubmitting} className="font-semibold">
              {inviteSubmitting ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
        {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
        {inviteMessage && <p className="mt-2 text-sm text-emerald-600">{inviteMessage}</p>}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">All platform users</h2>
        {listError && <p className="mt-2 text-sm text-red-600">{listError}</p>}
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
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.full_name ?? "—"}</td>
                  <td className="py-2 pr-4">
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
      </Card>
    </div>
  );
}
