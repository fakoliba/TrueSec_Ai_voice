"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IntakeQuestionsEditor } from "@/components/intake/IntakeQuestionsEditor";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import { cn, inputClassName } from "@/lib/utils";

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
    return (
      <p className="mx-auto max-w-4xl py-12 text-center text-sm text-muted-foreground">Loading…</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="text-center">
        <Link
          href={`/dashboard/${id}/intake/forms`}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Forms
        </Link>
        <h1 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">Edit intake form</h1>
      </div>

      {error && !form && (
        <p className="mt-4 text-center text-sm text-red-600">{error}</p>
      )}

      {form && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mx-auto max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(inputClassName, "mt-1.5")}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Industry / intake type</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={cn(inputClassName, "mt-1.5")}
              >
                {FORM_INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex flex-col items-center gap-2 sm:items-start">
                <button
                  type="button"
                  onClick={applyStarterTemplate}
                  className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/25"
                >
                  Apply starter fields for this industry
                </button>
                <p className="text-center text-xs text-muted-foreground sm:text-left">
                  Replaces your current fields with the template for the selected industry.
                </p>
              </div>
            </div>
            <label className="flex items-center justify-center gap-2 sm:justify-start">
              <input
                type="checkbox"
                id="active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-foreground">Active</span>
            </label>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-center text-sm font-semibold text-foreground sm:text-left">Fields</h2>
            <div className="mt-4">
              <IntakeQuestionsEditor value={questions} onChange={setQuestions} />
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <button
              type="button"
              className="w-full px-4 py-3 text-center text-sm font-medium text-foreground transition hover:bg-[#f8fafc] sm:text-left"
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
              <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                <textarea
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                  rows={12}
                  className={cn(inputClassName, "font-mono text-sm")}
                />
                <button
                  type="button"
                  onClick={applyJsonFromAdvanced}
                  className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/25"
                >
                  Apply JSON to fields
                </button>
              </div>
            )}
          </Card>

          {error && (
            <p className="text-center text-sm text-red-600 sm:text-left">{error}</p>
          )}

          <div className="flex justify-center pb-4 pt-1">
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
