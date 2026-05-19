"use client";

import type { IntakeQuestion } from "@/lib/api";
import {
  DEFAULT_NEW_FIELD_LABEL,
  questionTypes,
  slugifyFieldId,
} from "@/lib/intakeQuestionsHelpers";
import { cn, inputClassName } from "@/lib/utils";

type Props = {
  value: IntakeQuestion[];
  onChange: (next: IntakeQuestion[]) => void;
};

function collectIds(questions: IntakeQuestion[]): Set<string> {
  return new Set(questions.map((q) => (q.id ?? "").trim()).filter(Boolean));
}

/** Ids assigned to other rows (for unique slug when field name changes). */
function idsExcluding(questions: IntakeQuestion[], excludeIndex: number): Set<string> {
  const s = new Set<string>();
  questions.forEach((q, j) => {
    if (j !== excludeIndex && (q.id ?? "").trim()) s.add(q.id.trim());
  });
  return s;
}

function updateAt(arr: IntakeQuestion[], index: number, patch: Partial<IntakeQuestion>): IntakeQuestion[] {
  const next = [...arr];
  next[index] = { ...next[index], ...patch };
  return next;
}

const fieldInputClass = cn(inputClassName, "py-2 text-sm");
const fieldSelectClass = cn(fieldInputClass, "pr-8");

export function IntakeQuestionsEditor({ value, onChange }: Props) {
  const types = questionTypes();

  function addField() {
    const ids = collectIds(value);
    const id = slugifyFieldId(DEFAULT_NEW_FIELD_LABEL, ids);
    onChange([...value, { id, type: "text", label: DEFAULT_NEW_FIELD_LABEL, required: false }]);
  }

  function removeAt(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const copy = [...value];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  /** Sync slug id from label when the user leaves the field — avoids changing `key` every keystroke (which remounted rows and dropped focus). */
  function syncFieldIdFromLabel(i: number) {
    const q = value[i];
    if (!q) return;
    const label = q.label ?? "";
    const id = slugifyFieldId(label.trim() || "field", idsExcluding(value, i));
    if (id !== q.id) {
      onChange(updateAt(value, i, { id }));
    }
  }

  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-[#f8fafc] p-4 shadow-sm sm:p-5"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:items-end">
            <div>
              <label className="dashboard-hint block text-xs font-medium">Name</label>
              <input
                value={q.label}
                onChange={(e) => onChange(updateAt(value, i, { label: e.target.value }))}
                onBlur={() => syncFieldIdFromLabel(i)}
                className={cn(fieldInputClass, "mt-1")}
                placeholder="e.g. First name"
              />
            </div>
            <div>
              <label className="dashboard-hint block text-xs font-medium">Type</label>
              <select
                value={q.type}
                onChange={(e) => {
                  const type = e.target.value;
                  const patch: Partial<IntakeQuestion> = { type };
                  if (type !== "select") patch.options = undefined;
                  onChange(updateAt(value, i, patch));
                }}
                className={cn(fieldSelectClass, "mt-1")}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-center gap-2 pb-2 text-sm text-foreground sm:justify-start sm:pb-2.5">
              <input
                type="checkbox"
                checked={Boolean(q.required)}
                onChange={(e) => onChange(updateAt(value, i, { required: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              Required
            </label>
          </div>

          <div className="mt-3 max-w-lg">
            <label className="dashboard-hint block text-xs font-medium">Placeholder (optional)</label>
            <input
              value={q.placeholder ?? ""}
              onChange={(e) =>
                onChange(updateAt(value, i, { placeholder: e.target.value || undefined }))
              }
              className={cn(fieldInputClass, "mt-1")}
            />
          </div>

          {q.type === "select" && (
            <div className="mt-3">
              <label className="dashboard-hint block text-xs font-medium">
                Options (one per line)
              </label>
              <textarea
                value={(q.options ?? []).join("\n")}
                onChange={(e) => {
                  const options = e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  onChange(updateAt(value, i, { options }));
                }}
                rows={4}
                className={cn(fieldInputClass, "mt-1 font-mono")}
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-border/60 pt-4 sm:justify-start">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:border-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:border-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addField}
        className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-white px-4 py-3 text-sm font-medium text-primary transition hover:border-primary/50 hover:bg-primary/5"
      >
        + Add field
      </button>
    </div>
  );
}
