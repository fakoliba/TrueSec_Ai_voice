import type { IntakeQuestion } from "@/lib/api";

const QUESTION_TYPES = ["text", "textarea", "number", "date", "select", "file"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export function questionTypes(): readonly string[] {
  return QUESTION_TYPES;
}
/** Default label for a newly added field (shown as field name). */
export const DEFAULT_NEW_FIELD_LABEL = "New field";

/** Create a URL-safe field id from a label; ensures uniqueness. */
export function slugifyFieldId(label: string, existingIds: Set<string>): string {
  let base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) base = "field";
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}_${n++}`;
  }
  existingIds.add(id);
  return id;
}

/**
 * Assign stable internal `id` for each question from its label (order-preserving, unique).
 * Authors only edit labels; ids are derived for API / response storage.
 */
export function assignQuestionIdsFromLabels(questions: IntakeQuestion[]): IntakeQuestion[] {
  const seen = new Set<string>();
  return questions.map((q) => {
    const labelTrim = (q.label ?? "").trim();
    const slugSource = labelTrim || "field";
    const id = slugifyFieldId(slugSource, seen);
    return { ...q, id, label: labelTrim };
  });
}

/** Coerce API/legacy rows into IntakeQuestion[]. */
export function normalizeQuestionsFromApi(raw: unknown): IntakeQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: IntakeQuestion[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    let label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) label = "Question";
    let id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) {
      id = slugifyFieldId(label, seen);
    } else {
      const base = id;
      let n = 2;
      while (seen.has(id)) {
        id = `${base}_${n++}`;
      }
    }
    seen.add(id);
    const type = typeof o.type === "string" && o.type ? o.type : "text";
    const q: IntakeQuestion = {
      id,
      type,
      label,
      required: Boolean(o.required),
    };
    if (typeof o.placeholder === "string" && o.placeholder) q.placeholder = o.placeholder;
    if (Array.isArray(o.options) && o.options.length) {
      q.options = o.options.map((x) => String(x)).filter(Boolean);
    }
    if (o.default !== undefined && o.default !== null) q.default = o.default;
    out.push(q);
  }
  return out;
}

/** Serialize for API (plain objects). Ids are derived from field names; authors do not edit ids. */
export function questionsToPayload(questions: IntakeQuestion[]): Record<string, unknown>[] {
  return assignQuestionIdsFromLabels(questions).map((q) => {
    const row: Record<string, unknown> = {
      id: q.id.trim(),
      type: q.type,
      label: q.label.trim(),
      required: Boolean(q.required),
    };
    if (q.placeholder) row.placeholder = q.placeholder;
    if (q.options?.length) row.options = q.options;
    if (q.default !== undefined) row.default = q.default;
    return row;
  });
}

export function validateIntakeQuestions(questions: IntakeQuestion[]): string | null {
  if (!questions.length) return "Add at least one field.";
  for (const q of questions) {
    const label = (q.label ?? "").trim();
    if (!label) return "Each field needs a name.";
    if (q.type === "select") {
      const opts = q.options?.filter(Boolean) ?? [];
      if (!opts.length) return `Select field "${label}" needs at least one option.`;
    }
  }
  return null;
}
