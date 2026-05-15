# Intake questions: visual editor + industry type + starter templates

## Problem

- `IntakeForm.questions` stays JSON in DB/API (unchanged).
- Dashboard today uses a raw JSON textarea; business owners cannot maintain it.
- Owners need a **non-technical** flow and an **intake/industry type** (Healthcare, IT, etc.), not a free-text “form type” field.

## Decisions (iteration)

### 1. “Second option” = industry starter templates (not Advanced JSON as primary)

- Primary flow: **visual question editor** (add/remove/reorder, fields per question).
- **Second path**: when creating a form (or changing type), user picks **Industry / intake type** from a fixed list; the app **pre-fills starter questions** for that vertical. User then adjusts in the same visual editor.
- Optional **Advanced: JSON** remains available **collapsed** for support/power users only (not the main “second option”).

### 2. Intake type selector (Healthcare, IT, …)

- Replace free-text “Form type” on **new** and **edit** intake form pages with a **`<select>`** of predefined values, e.g.:
  - `general` — General / other
  - `healthcare` — Healthcare
  - `it` — IT / technology
  - `retail` — Retail
  - `professional_services` — Professional services
  - (keep list short; `max_length=50` on [`form_type`](app/models/intake.py) is already sufficient)
- Persist as today: `form_type` string on create/update (API unchanged).
- **New form:** default selection (e.g. `general`) + load matching **starter template** into editor state.
- **Edit form:** show current `form_type`; changing type can prompt: “Load starter questions for this industry? (replaces current list)” to avoid accidental wipes — or only offer “Apply template” button without auto-replace.

## Implementation outline

| Piece | Detail |
|-------|--------|
| Types | `IntakeQuestion` in frontend; `FORM_INDUSTRY_OPTIONS` constant with `{ value, label }[]` |
| Templates | `INTAKE_STARTER_QUESTIONS: Record<string, IntakeQuestion[]>` in e.g. `frontend/src/lib/intakeTemplates.ts` — distinct sets for healthcare (e.g. DOB, insurance), IT (company size, issue type), etc. |
| `IntakeQuestionsEditor` | Same as prior plan: label, type, required, placeholder, options for `select`, auto slug `id`, reorder |
| Pages | `new/page.tsx`, `[formId]/page.tsx`: industry `<select>` bound to `form_type`; wire templates on create / optional “Apply template”; remove JSON textarea as primary |
| Backend | No migration if we only use `form_type` strings; optional future: validate allowed values in Pydantic `Field(..., pattern=...)` or `Literal` — not required for MVP |

## Validation

- Client-side: duplicate IDs, empty labels, `select` without options; normalize missing `id` on load.
- Template apply: confirm when replacing existing questions on edit.

## Out of scope (MVP)

- Changing AI intake logic based on `form_type` (can be a follow-up).
- Server-side enum enforcement (optional later).

## Todos

1. Add TS types + `FORM_INDUSTRY_OPTIONS` + `intakeTemplates.ts` starter arrays.
2. Build `IntakeQuestionsEditor` (add/remove/reorder, fields).
3. Update new + edit pages: industry selector, template apply flow, replace JSON with editor; optional collapsed Advanced JSON.
4. Validation + confirm dialog when applying template over existing questions.

## Implemented (status)

- `frontend/src/lib/api.ts` — `IntakeQuestion` type; `IntakeFormRecord.questions` typed as `IntakeQuestion[]`.
- `frontend/src/lib/intakeFormConstants.ts` — `FORM_INDUSTRY_OPTIONS`, `INTAKE_STARTER_QUESTIONS`, `getStarterQuestionsForIndustry`, `normalizeIndustryValue`.
- `frontend/src/lib/intakeQuestionsHelpers.ts` — normalize, validate, `questionsToPayload`, `slugifyFieldId`.
- `frontend/src/components/intake/IntakeQuestionsEditor.tsx` — visual editor.
- `frontend/src/app/dashboard/[id]/intake/forms/new/page.tsx` — industry select + starters + editor + advanced JSON.
- `frontend/src/app/dashboard/[id]/intake/forms/[formId]/page.tsx` — same + "Apply starter questions" with confirm.

