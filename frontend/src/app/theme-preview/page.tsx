import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Local preview of theme tokens, typography, and dashboard-like surfaces.
 * Run: `cd frontend && npm run dev` → open http://localhost:3000/theme-preview
 * (No login required.)
 */
export default function ThemePreviewPage() {
  const swatches = [
    { name: "primary (gold accent)", var: "--color-primary", hex: "#d4af37" },
    { name: "cta (filled buttons)", var: "--color-cta", hex: "#6d5e5e" },
    { name: "secondary", var: "--color-secondary", hex: "#4a4543" },
    { name: "text", var: "--color-foreground", hex: "#ffffff" },
    { name: "background", var: "--color-background", hex: "#1a1a1a" },
    { name: "card", var: "--color-card", hex: "#231f20" },
    { name: "border", var: "--color-border", hex: "#3d3a38" },
    { name: "muted foreground", var: "--color-muted-foreground", hex: "#a1a1aa" },
    { name: "hero gradient", var: "--hero-from → --hero-to", hex: "#5e5b66 → #7ba1b8" },
  ];

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl space-y-12">
        <header>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              ← Home
            </Link>
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Theme &amp; typography preview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review colors and fonts here before deploying. Tokens live in{" "}
            <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs ring-1 ring-border">
              src/app/globals.css
            </code>
            .
          </p>
          <p className="mt-3 rounded-lg border border-border bg-card/80 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Dev:</strong> <code className="text-primary">cd frontend && npm run dev</code> →{" "}
            <code className="text-primary">/theme-preview</code>
          </p>
        </header>

        <section aria-labelledby="typography-heading">
          <h2 id="typography-heading" className="text-lg font-semibold">
            Typography (Geist Sans / Mono)
          </h2>
          <div className="mt-4 space-y-4 rounded-xl border border-border bg-card p-6 ring-1 ring-border/20">
            <p className="text-3xl font-bold tracking-tight">Heading — Page title</p>
            <p className="text-xl font-semibold">Subheading — Section</p>
            <p className="text-base text-foreground">
              Body: The quick brown fox jumps over the lazy dog. Numbers 0123456789.
            </p>
            <p className="text-sm text-muted-foreground">
              Muted: Secondary copy, hints, and captions should use muted-foreground for contrast on dark
              backgrounds.
            </p>
            <p className="font-mono text-sm text-foreground">
              Mono: voice_sid=CAxxxxxxxx / API keys / logs
            </p>
          </div>
        </section>

        <section aria-labelledby="dashboard-mock-heading">
          <h2 id="dashboard-mock-heading" className="text-lg font-semibold">
            Dashboard layout (simulated)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Top bar + sidebar use card/gradient browns; main content uses{" "}
            <code className="rounded bg-card px-1 font-mono text-xs">bg-background</code> with{" "}
            <code className="rounded bg-card px-1 font-mono text-xs">text-foreground</code>.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border ring-1 ring-border/20">
            <div className="border-b border-border bg-card/95 px-4 py-3 text-sm font-bold">
              true<span className="text-primary">Sec</span>AI <span className="ml-4 font-normal text-muted-foreground">Header</span>
            </div>
            <div className="flex min-h-[200px]">
              <aside
                className="w-40 shrink-0 border-r border-border bg-gradient-to-b from-card to-background p-3 text-xs text-muted-foreground"
                aria-hidden
              >
                <div className="rounded-lg bg-primary px-2 py-1.5 text-center text-primary-foreground">Nav item</div>
                <div className="mt-2 rounded-lg px-2 py-1.5 text-center hover:bg-card">Link</div>
              </aside>
              <main className="flex-1 bg-background p-4">
                <h3 className="font-semibold text-foreground">Main content</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This strip matches the dashboard: dark page, light text. Avoid{" "}
                  <code className="text-foreground">text-zinc-900</code> here — it is nearly invisible on dark
                  backgrounds.
                </p>
              </main>
            </div>
          </div>
        </section>

        <section aria-labelledby="swatches-heading">
          <h2 id="swatches-heading" className="text-lg font-semibold">
            Color swatches
          </h2>
          <ul className="mt-4 space-y-3">
            {swatches.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 ring-1 ring-border/20"
              >
                <span
                  className="h-12 w-12 shrink-0 rounded-lg border border-border shadow-inner"
                  style={
                    s.var.includes("hero")
                      ? {
                          background: "linear-gradient(90deg, #5e5b66, #7ba1b8)",
                        }
                      : { backgroundColor: s.hex.split(" ")[0] }
                  }
                  aria-hidden
                />
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.var} · {s.hex}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Card className="space-y-4">
          <p className="text-sm font-semibold">Sample controls</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="md">
              Primary
            </Button>
            <Button variant="secondary" size="md">
              Secondary
            </Button>
            <Button variant="ghost" size="md">
              Ghost
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
