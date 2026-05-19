"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IntakeQuestionsEditor } from "@/components/intake/IntakeQuestionsEditor";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import { cn, inputClassName } from "@/lib/utils";

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
    <div className="mx-auto w-full max-w-4xl">
      <div className="text-center">
        <Link
          href={`/dashboard/${id}/intake/forms`}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Forms
        </Link>
        <h1 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">New intake form</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Define the fields customers complete before or during their visit.
        </p>
      </div>

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
              onChange={(e) => handleIndustryChange(e.target.value)}
              className={cn(inputClassName, "mt-1.5")}
            >
              {FORM_INDUSTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
              <p className="mt-1.5 text-center text-xs text-muted-foreground sm:text-left">
                Chooses a starter set of fields. You can edit them below.
              </p>
            </div>
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
            {saving ? "Creating…" : "Create form"}
          </Button>
        </div>
      </form>
    </div>
  );
}
