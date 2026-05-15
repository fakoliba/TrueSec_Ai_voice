"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IntakeQuestionsEditor } from "@/components/intake/IntakeQuestionsEditor";
import { getIntakeForm, updateIntakeForm } from "@/lib/api";
import type { IntakeFormRecord, IntakeQuestion } from "@/lib/api";
import {
  FORM_INDUSTRY_OPTIONS,
  getStarterQuestionsForIndustry,
  normalizeIndustryValue,
} from "@/lib/intakeFormConstants";
import {
  normalizeQuestionsFromApi,
  questionsToPayload,
  validateIntakeQuestions,
} from "@/lib/intakeQuestionsHelpers";

export default function EditIntakeFormPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const formId = Number(params.formId);
  const businessId = Number(id);
  const [form, setForm] = useState<IntakeFormRecord | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("general");
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [questionsJson, setQuestionsJson] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const f = await getIntakeForm(businessId, formId);
      setForm(f);
      setName(f.name);
      setIndustry(normalizeIndustryValue(f.form_type));
      setQuestions(normalizeQuestionsFromApi(f.questions));
      setIsActive(f.is_active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId, formId]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    void load();
  }, [router, load]);

  function applyJsonFromAdvanced() {
    setError("");
    try {
      const parsed = JSON.parse(questionsJson) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Fields must be a JSON array");
      setQuestions(normalizeQuestionsFromApi(parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  function applyStarterTemplate() {
    if (
      !window.confirm(
        "Replace all current fields with the starter set for this industry? This cannot be undone from here.",
      )
    ) {
      return;
    }
    setQuestions(getStarterQuestionsForIndustry(industry));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const v = validateIntakeQuestions(questions);
    if (v) {
      setError(v);
      setSaving(false);
      return;
    }
    try {
      const updated = await updateIntakeForm(businessId, formId, {
        name: name.trim(),
        form_type: industry || null,
        questions: questionsToPayload(questions),
        is_active: isActive,
      });
      setForm(updated);
      setQuestions(normalizeQuestionsFromApi(updated.questions));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !form) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <Link href={`/dashboard/${id}/intake/forms`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Forms
      </Link>
      <h1 className="text-xl font-bold text-foreground">Edit intake form</h1>
      {error && !form && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {form && (
        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Industry / intake type</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            >
              {FORM_INDUSTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="mt-2">
              <button
                type="button"
                onClick={applyStarterTemplate}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/30"
              >
                Apply starter fields for this industry
              </button>
              <p className="mt-1 text-xs text-muted-foreground">
                Replaces your current fields with the template for the selected industry.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="active" className="text-sm text-foreground">
              Active
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Fields</label>
            <div className="mt-2">
              <IntakeQuestionsEditor value={questions} onChange={setQuestions} />
            </div>
          </div>
          <div className="rounded-lg border border-border">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/30"
              onClick={() => {
                setShowAdvancedJson(!showAdvancedJson);
                if (!showAdvancedJson) {
                  setQuestionsJson(JSON.stringify(questions, null, 2));
                }
              }}
            >
              {showAdvancedJson ? "▼" : "▶"} Advanced: edit as JSON
            </button>
            {showAdvancedJson && (
              <div className="space-y-2 border-t border-border p-3">
                <textarea
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={applyJsonFromAdvanced}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground"
                >
                  Apply JSON to fields
                </button>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-cta px-4 py-2 text-sm font-medium text-cta-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
