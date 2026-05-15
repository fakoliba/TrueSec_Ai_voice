"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, deleteBusiness, updateBusiness } from "@/lib/api";
import type { Business } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function EditBusinessPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("United States");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    apiFetch(`/api/businesses/${id}`, { token })
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load business");
        return res.json();
      })
      .then((b: Business | null) => {
        if (b) {
          setName(b.name);
          setBusinessType(b.business_type || "");
          setEmail(b.email || "");
          setPhone(b.phone || "");
          const full = (b.address || "").trim();
          if (full) {
            const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
            // Best-effort parse based on "street, City State ZIP, Country"
            if (parts.length === 1) {
              setStreetAddress(parts[0]);
            } else if (parts.length === 2) {
              setStreetAddress(parts[0]);
              const cityStateZip = parts[1];
              const tokens = cityStateZip.split(/\s+/);
              if (tokens.length >= 1) setCity(tokens[0]);
              if (tokens.length >= 2) setStateRegion(tokens[1]);
              if (tokens.length >= 3) setPostalCode(tokens.slice(2).join(" "));
            } else {
              setStreetAddress(parts[0]);
              const cityStateZip = parts[1];
              const tokens = cityStateZip.split(/\s+/);
              if (tokens.length >= 1) setCity(tokens[0]);
              if (tokens.length >= 2) setStateRegion(tokens[1]);
              if (tokens.length >= 3) setPostalCode(tokens.slice(2).join(" "));
              setCountry(parts[2]);
            }
          }
          setTimezone(b.timezone || "UTC");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const addressParts = [
        streetAddress.trim(),
        [city.trim(), stateRegion.trim(), postalCode.trim()].filter(Boolean).join(" "),
        country.trim(),
      ].filter(Boolean);

      await updateBusiness(Number(id), {
        name: name.trim(),
        business_type: businessType.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: addressParts.join(", "),
        timezone: timezone.trim() || "UTC",
      });
      router.push(`/dashboard/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update business");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteBusiness(Number(id));
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete business");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
      <Link href={`/dashboard/${id}`} className="mb-4 inline-block text-sm text-muted-foreground hover:underline">
        ← Back to business
      </Link>
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">Edit business</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="business_type" className="mb-1 block text-sm font-medium text-foreground">
              Type
            </label>
            <input
              id="business_type"
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. dental, medical, retail"
              maxLength={50}
              className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-foreground">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Billing address <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 space-y-2">
              <input
                id="street_address"
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                required
                placeholder="Street address"
                maxLength={255}
                className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  placeholder="City"
                  maxLength={100}
                  className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  id="state"
                  type="text"
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  required
                  placeholder="State / Province"
                  maxLength={100}
                  className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  id="postal_code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  placeholder="ZIP / Postal code"
                  maxLength={20}
                  className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                placeholder="Country"
                maxLength={100}
                className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-foreground">
              Timezone
            </label>
            <input
              id="timezone"
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              maxLength={50}
              className="w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link
              href={`/dashboard/${id}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/20"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-8 border-t border-red-100 pt-6">
          <h2 className="text-sm font-semibold text-red-900">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete this business and related data. This cannot be undone.
          </p>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="mt-3 font-semibold"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete business
          </Button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Delete business?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently delete &quot;{name}&quot; and all related data. This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="danger" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
