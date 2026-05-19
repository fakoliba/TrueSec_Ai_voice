"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onboardPlatformBusiness } from "@/lib/api";
import type { Business } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { inputClassName } from "@/lib/utils";

export default function PlatformOnboardPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Business | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const business = await onboardPlatformBusiness({
        business_name: businessName.trim(),
        business_type: businessType.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        address: address.trim(),
        timezone: timezone.trim() || "UTC",
        owner_first_name: ownerFirstName.trim() || null,
        owner_last_name: ownerLastName.trim() || null,
        password,
      });
      setCreated(business);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">Business created</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The owner account is ready. You were not added as a member.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/dashboard/${created.id}`} className={buttonClasses("primary", "md")}>
              Open business
            </Link>
            <Link href="/platform" className={buttonClasses("secondary", "md")}>
              Back to platform
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
          ← Platform
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Onboard business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a new business and a new owner user. You will not be added as owner.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Business</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Business name *</label>
              <input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClassName}
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Business type</label>
              <input
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className={inputClassName}
                placeholder="e.g. clinic, salon"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Address *</label>
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClassName}
                autoComplete="street-address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Timezone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={inputClassName}
                  placeholder="UTC"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClassName}
                  type="tel"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Owner</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Owner email *</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">First name</label>
                <input
                  value={ownerFirstName}
                  onChange={(e) => setOwnerFirstName(e.target.value)}
                  className={inputClassName}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Last name</label>
                <input
                  value={ownerLastName}
                  onChange={(e) => setOwnerLastName(e.target.value)}
                  className={inputClassName}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Temporary password *</label>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClassName}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-muted-foreground">Share this with the owner so they can sign in.</p>
            </div>
          </div>
        </Card>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create business & owner"}
          </Button>
          <Link href="/platform" className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
