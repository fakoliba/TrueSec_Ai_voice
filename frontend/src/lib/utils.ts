/** Merge class names; falsy values are omitted. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Shared focus ring for interactive controls (links to primary). */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Default text input styling. */
export const inputClassName =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-foreground shadow-sm transition placeholder:text-muted-foreground hover:border-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
