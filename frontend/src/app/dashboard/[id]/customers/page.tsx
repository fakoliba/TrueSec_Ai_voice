"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  createBusinessCustomer,
  deleteBusinessCustomer,
  importBusinessCustomersCsv,
  listBusinessCustomers,
  type BusinessCustomer,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { PhiReveal } from "@/components/security/PhiReveal";
import { inputClassName, cn } from "@/lib/utils";

export default function BusinessCustomersPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);

  const [customers, setCustomers] = useState<BusinessCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(true);
    listBusinessCustomers(businessId)
      .then(setCustomers)
      .catch((e) => setMessage(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [businessId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!firstName.trim() || !lastName.trim()) {
      setMessage("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      const c = await createBusinessCustomer(businessId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      setCustomers((prev) => [c, ...prev].sort((a, b) => a.last_name.localeCompare(b.last_name)));
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setMessage("Customer saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage("");
    setImporting(true);
    try {
      const r = await importBusinessCustomersCsv(businessId, file);
      setMessage(
        `Import complete: ${r.created} created, ${r.updated} updated.` +
          (r.row_errors?.length ? ` ${r.row_errors.length} row warnings (see server logs).` : ""),
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(customerId: number) {
    if (!confirm("Remove this customer from your directory?")) return;
    try {
      await deleteBusinessCustomer(businessId, customerId);
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      setMessage("Customer removed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <BusinessPageShell
      section="Customers"
      title="Customers"
      description="Keep phone numbers on file so voice reschedule and cancel can find upcoming visits. Add manually or import a CSV."
    >
      {message && (
        <p className={cn("mt-3 text-sm", message.includes("Failed") || message.includes("warnings") ? "text-amber-600" : "text-muted-foreground")}>
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,20rem)]">
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Directory</h2>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : customers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No customers yet. Add one or import a spreadsheet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {customers.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {c.phone ? <PhiReveal value={c.phone} kind="phone" /> : null}
                      {c.phone && c.email ? <span aria-hidden>·</span> : null}
                      {c.email ? <PhiReveal value={c.email} kind="email" /> : null}
                      {!c.phone && !c.email ? "—" : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => void handleDelete(c.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6 lg:max-w-sm">
          <Card>
            <h2 className="text-sm font-semibold text-foreground">Add customer</h2>
            <form onSubmit={(e) => void handleAdd(e)} className="mt-4 space-y-3">
              <input
                className={cn(inputClassName, "max-w-full")}
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <input
                className={cn(inputClassName, "max-w-full")}
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
              <input
                className={cn(inputClassName, "max-w-full")}
                placeholder="Phone (E.164 or local)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                type="email"
                className={cn(inputClassName, "max-w-full")}
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="pt-1">
                <Button type="submit" variant="primary" size="md" disabled={saving}>
                  {saving ? "Saving…" : "Save customer"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-foreground">Import CSV</h2>
            <p className="dashboard-hint mt-1 text-xs leading-relaxed">
              Headers: <code className="dashboard-inline-code">first_name</code>,{" "}
              <code className="dashboard-inline-code">last_name</code>,{" "}
              <code className="dashboard-inline-code">phone</code> (required). Optional:{" "}
              <code className="dashboard-inline-code">email</code>,{" "}
              <code className="dashboard-inline-code">date_of_birth</code>. Existing rows match by phone
              (last 10 digits).
            </p>
            <label className="mt-4 block">
              <span className="sr-only">Upload CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className={cn(
                  "block w-full max-w-full cursor-pointer text-sm text-muted-foreground",
                  "file:mr-3 file:cursor-pointer file:rounded-xl file:border-0",
                  "file:bg-cta file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-cta-foreground",
                  "file:shadow-sm file:transition file:duration-200 hover:file:bg-cta/90",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                disabled={importing}
                onChange={(e) => void handleFileChange(e)}
              />
            </label>
            {importing && <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>}
          </Card>
        </div>
      </div>
    </BusinessPageShell>
  );
}
