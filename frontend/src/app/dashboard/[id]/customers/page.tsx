"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function runCsvImport(file: File) {
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await runCsvImport(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (importing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void runCsvImport(file);
  }

  function downloadCsvTemplate() {
    const header = "first_name,last_name,phone,email,date_of_birth";
    const sample = "Jane,Smith,+15551234567,jane@example.com,1990-01-15";
    const blob = new Blob([`${header}\n${sample}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "customers-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 pr-4 font-semibold">Name</th>
                    <th className="py-2.5 pr-4 font-semibold">Phone</th>
                    <th className="py-2.5 pr-4 font-semibold">Email</th>
                    <th className="py-2.5 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="py-3 pr-4">
                        {c.phone ? (
                          <PhiReveal value={c.phone} kind="phone" className="text-xs" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {c.email ? (
                          <PhiReveal value={c.email} kind="email" className="text-xs" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          className="text-xs font-medium text-destructive hover:underline"
                          onClick={() => void handleDelete(c.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                aria-hidden
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Import CSV</h2>
                <p className="dashboard-hint mt-0.5 text-xs">Bulk add or update customers from a spreadsheet.</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-[#f8fafc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Column format</p>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="font-medium text-foreground">Required</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {["first_name", "last_name", "phone"].map((col) => (
                      <code key={col} className="dashboard-inline-code">
                        {col}
                      </code>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-foreground">Optional</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {["email", "date_of_birth"].map((col) => (
                      <code key={col} className="dashboard-inline-code">
                        {col}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
              <p className="dashboard-hint mt-3 border-t border-border/70 pt-3 text-[11px] leading-relaxed">
                First row must be headers. Existing customers are updated when the phone number matches (last 10
                digits).
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={importing}
              onChange={(e) => void handleFileChange(e)}
            />

            <div
              role="presentation"
              onDragEnter={(e) => {
                e.preventDefault();
                if (!importing) setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                "mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-primary/25 bg-white hover:border-primary/40 hover:bg-primary/[0.03]",
                importing && "pointer-events-none opacity-60",
              )}
            >
              {importing ? (
                <>
                  <span className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm font-medium text-foreground">Importing…</p>
                  <p className="dashboard-hint mt-1 text-xs">This may take a moment for large files.</p>
                </>
              ) : (
                <>
                  <svg
                    className="mb-3 h-8 w-8 text-primary/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-foreground">Drag &amp; drop your CSV here</p>
                  <p className="dashboard-hint mt-1 text-xs">or</p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse files
                  </Button>
                  <p className="dashboard-hint mt-3 text-[11px]">Accepted format: .csv</p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={downloadCsvTemplate}
              disabled={importing}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-xs font-medium text-primary shadow-sm transition hover:border-primary/25 hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download sample template
            </button>
          </Card>
        </div>
      </div>
    </BusinessPageShell>
  );
}
