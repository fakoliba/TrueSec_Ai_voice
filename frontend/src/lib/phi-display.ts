/**
 * Display helpers for PHI/PII — minimum-necessary presentation in the UI.
 * Does not remove data from API responses; only affects what is shown by default.
 */

/** Mask phone: show last 4 digits (E.164 or local). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `•••-•••-${digits.slice(-4)}`;
}

/** Mask email: j***@domain.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}•••@${domain}`;
}

/** Truncate free text for list views (transcripts, summaries). */
export function truncatePhiText(text: string, maxLen = 120): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/** Safe label for intake response keys (no raw JSON in tables). */
export function formatIntakeResponsePreview(responses: unknown): string {
  if (responses == null) return "—";
  if (typeof responses === "object" && !Array.isArray(responses)) {
    const keys = Object.keys(responses as Record<string, unknown>);
    return keys.length === 0 ? "Empty" : `${keys.length} field${keys.length === 1 ? "" : "s"}`;
  }
  return "Responses";
}
