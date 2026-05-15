"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { addBusinessUser, listBusinessUsers } from "@/lib/api";
import type { BusinessMember } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName, cn } from "@/lib/utils";

export default function BusinessTeamPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setMembersLoading(true);
    listBusinessUsers(Number(id))
      .then(setMembers)
      .catch((err) => {
        setInviteMessage(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => setMembersLoading(false));
  }, [id, router]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMessage("");
    if (!inviteEmail.trim()) {
      setInviteMessage("Please enter an email.");
      return;
    }
    if (addMode === "new" && (!newPassword || newPassword.length < 6)) {
      setInviteMessage("Password is required and must be at least 6 characters.");
      return;
    }
    setInviting(true);
    try {
      const payload =
        addMode === "new"
          ? {
              email: inviteEmail.trim(),
              role: inviteRole,
              full_name: newFullName.trim() || undefined,
              password: newPassword,
            }
          : { email: inviteEmail.trim(), role: inviteRole };
      const member = await addBusinessUser(Number(id), payload);
      setMembers((prev) => [...prev, member]);
      setInviteEmail("");
      setInviteRole("staff");
      setNewFullName("");
      setNewPassword("");
      setInviteMessage(
        addMode === "new" ? "New user created and added to business." : "User added to business.",
      );
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <Link href={`/dashboard/${id}`} className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
        ← Back to overview
      </Link>
      <h1 className="text-xl font-bold tracking-tight text-foreground">Team & users</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        View members and add existing or new users to this business.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1.5fr]">
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Team members</h2>
          {membersLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No team members yet. You can add existing users by email in the form.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {m.user_full_name || m.user_email || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.user_email}</p>
                  </div>
                  <span className="rounded-full bg-muted/25 px-2 py-1 text-xs font-medium text-foreground">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Add team member</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Only business owners or admins can add users. Add an existing account by email, or create a
            new user and add them to this business.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setAddMode("existing")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                addMode === "existing"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/25 text-foreground hover:bg-muted/40",
              )}
            >
              Add existing user
            </button>
            <button
              type="button"
              onClick={() => setAddMode("new")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                addMode === "new"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/25 text-foreground hover:bg-muted/40",
              )}
            >
              Create new user
            </button>
          </div>
          <form onSubmit={handleInvite} className="mt-4 space-y-3">
            <div>
              <label htmlFor="invite_email" className="mb-1 block text-xs font-medium text-foreground">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="invite_email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            {addMode === "new" && (
              <>
                <div>
                  <label
                    htmlFor="new_full_name"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Full name
                  </label>
                  <input
                    id="new_full_name"
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="new_password"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Password <span className="text-red-500">*</span> (min 6 characters)
                  </label>
                  <input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    className={inputClassName}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="invite_role" className="mb-1 block text-xs font-medium text-foreground">
                Role
              </label>
              <select
                id="invite_role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className={inputClassName}
              >
                <option value="staff">Staff (simple user)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {inviteMessage && <p className="text-xs text-muted-foreground">{inviteMessage}</p>}
            <Button type="submit" disabled={inviting} className="font-semibold">
              {inviting
                ? "Adding…"
                : addMode === "new"
                  ? "Create user and add"
                  : "Add user"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
