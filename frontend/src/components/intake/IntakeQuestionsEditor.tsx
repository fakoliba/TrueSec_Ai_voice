"use client";

import type { IntakeQuestion } from "@/lib/api";
import {
  DEFAULT_NEW_FIELD_LABEL,
  questionTypes,
  slugifyFieldId,
} from "@/lib/intakeQuestionsHelpers";

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
    <div className="space-y-4">
      {value.map((q, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-border bg-background/50 p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="block text-xs font-medium text-muted-foreground">Name</label>
              <input
                value={q.label}
                onChange={(e) => onChange(updateAt(value, i, { label: e.target.value }))}
                onBlur={() => syncFieldIdFromLabel(i)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                placeholder="e.g. First name"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={q.type}
                onChange={(e) => {
                  const type = e.target.value;
                  const patch: Partial<IntakeQuestion> = { type };
                  if (type !== "select") patch.options = undefined;
                  onChange(updateAt(value, i, patch));
                }}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-1 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(q.required)}
                onChange={(e) => onChange(updateAt(value, i, { required: e.target.checked }))}
                className="rounded border-border"
              />
              Required
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground">Placeholder (optional)</label>
            <input
              value={q.placeholder ?? ""}
              onChange={(e) =>
                onChange(updateAt(value, i, { placeholder: e.target.value || undefined }))
              }
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>

          {q.type === "select" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
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
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="rounded border border-red-900/50 px-2 py-1 text-xs text-red-400"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addField}
        className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-foreground hover:bg-muted/30"
      >
        + Add field
      </button>
    </div>
  );
}
