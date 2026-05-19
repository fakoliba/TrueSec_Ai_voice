import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthShell } from "@/components/ui/AuthShell";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <AuthShell>
      <main className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#071a3d]">
            true<span className="text-[#d4af37]">Sec</span>.AI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your AI front desk
          </h1>
          <p className="mt-3 text-balance text-muted-foreground">
            Sign in to manage businesses, calendars, voice, and customer conversations—all in one place.
          </p>
        </div>
        <Card className="p-8">
          <Link
            href="/login"
            className={cn(buttonClasses("primary", "md"), "w-full justify-center font-semibold shadow-md shadow-primary/20")}
          >
            Sign in
          </Link>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <a
              href="mailto:truesecai@truesecai.com"
              className="font-medium text-primary hover:underline"
            >
              Contact us
            </a>
          </p>
        </Card>
        {process.env.NODE_ENV === "development" ? (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Dev API:{" "}
            <code className="dashboard-inline-code">
              {process.env.NEXT_PUBLIC_USE_API_PROXY === "false"
                ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
                : "/api (proxied)"}
            </code>
          </p>
        ) : null}
      </main>
    </AuthShell>
  );
}
