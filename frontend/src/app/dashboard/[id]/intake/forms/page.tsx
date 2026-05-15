"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deleteIntakeForm, listIntakeForms } from "@/lib/api";
import type { IntakeFormRecord } from "@/lib/api";

export default function IntakeFormsListPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);
  const [forms, setForms] = useState<IntakeFormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setForms(await listIntakeForms(businessId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    void load();
  }, [router, load]);

  async function handleDelete(formId: number) {
    if (!confirm("Delete this form? Submissions are kept.")) return;
    try {
      await deleteIntakeForm(businessId, formId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <Link href={`/dashboard/${id}/intake`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Intake
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Intake forms</h1>
        <Link
          href={`/dashboard/${id}/intake/forms/new`}
          className="rounded-xl bg-cta px-4 py-2 text-sm font-medium text-cta-foreground hover:bg-cta/90"
        >
          New form
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Use stable question <code className="rounded bg-card px-1 text-xs">id</code> values (e.g. first_name); the AI
        maps them to customer records when possible.
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : forms.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No forms yet. Create one to enable AI intake.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {forms.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <span className="font-medium text-foreground">{f.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {f.is_active ? "Active" : "Inactive"} · {Array.isArray(f.questions) ? f.questions.length : 0}{" "}
                  questions
                </span>
              </div>
              <div className="flex gap-3">
                <Link href={`/dashboard/${id}/intake/forms/${f.id}`} className="text-sm text-primary hover:underline">
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  className="text-sm text-red-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
