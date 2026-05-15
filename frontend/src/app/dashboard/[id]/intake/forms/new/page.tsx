"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IntakeQuestionsEditor } from "@/components/intake/IntakeQuestionsEditor";
import { createIntakeForm, type IntakeQuestion } from "@/lib/api";
import {
  FORM_INDUSTRY_OPTIONS,
  getStarterQuestionsForIndustry,
} from "@/lib/intakeFormConstants";
import {
  normalizeQuestionsFromApi,
  questionsToPayload,
  validateIntakeQuestions,
} from "@/lib/intakeQuestionsHelpers";

export default function NewIntakeFormPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);
  const [name, setName] = useState("New customer");
  const [industry, setIndustry] = useState("general");
  const [questions, setQuestions] = useState<IntakeQuestion[]>(() =>
    getStarterQuestionsForIndustry("general"),
  );
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [questionsJson, setQuestionsJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleIndustryChange(next: string) {
    setIndustry(next);
    setQuestions(getStarterQuestionsForIndustry(next));
  }

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
      const form = await createIntakeForm(businessId, {
        name: name.trim(),
        form_type: industry || null,
        questions: questionsToPayload(questions),
        is_active: true,
      });
      router.push(`/dashboard/${id}/intake/forms/${form.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href={`/dashboard/${id}/intake/forms`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Forms
      </Link>
      <h1 className="text-xl font-bold text-foreground">New intake form</h1>
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
            onChange={(e) => handleIndustryChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          >
            {FORM_INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Chooses a starter set of fields. You can edit them below.
          </p>
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
          {saving ? "Creating…" : "Create form"}
        </button>
      </form>
    </div>
  );
}
