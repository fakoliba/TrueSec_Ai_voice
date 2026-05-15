"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBusiness } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName, cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/Button";

export default function NewBusinessPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("United States");
  const [timezone, setTimezone] = useState(() => {
    // Prefer the user's system timezone; fall back to UTC
    if (typeof window === "undefined") return "UTC";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz || "UTC";
    } catch {
      return "UTC";
    }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const addressParts = [
        streetAddress.trim(),
        [city.trim(), stateRegion.trim(), postalCode.trim()].filter(Boolean).join(" "),
        country.trim(),
      ].filter(Boolean);

      const business = await createBusiness({
        name: name.trim(),
        business_type: businessType.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: addressParts.join(", "),
        timezone: timezone.trim() || "UTC",
      });
      router.push(`/dashboard/${business.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create business");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <Link href="/dashboard" className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
        ← Back to businesses
      </Link>
      <Card>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Create business</h1>
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
              className={inputClassName}
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
              className={inputClassName}
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
              className={inputClassName}
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
              className={inputClassName}
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
                className={inputClassName}
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
                  className={inputClassName}
                />
                <input
                  id="state"
                  type="text"
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  required
                  placeholder="State / Province"
                  maxLength={100}
                  className={inputClassName}
                />
                <input
                  id="postal_code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  placeholder="ZIP / Postal code"
                  maxLength={20}
                  className={inputClassName}
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
                className={inputClassName}
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
              className={inputClassName}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={loading} className="font-semibold">
              {loading ? "Creating…" : "Create business"}
            </Button>
            <Link href="/dashboard" className={cn(buttonClasses("secondary", "md"), "font-semibold")}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
