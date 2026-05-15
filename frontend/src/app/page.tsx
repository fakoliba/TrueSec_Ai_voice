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
          <p className="text-sm font-medium uppercase tracking-wider text-primary">trueSecAI</p>
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
        <p className="mt-8 text-center text-xs text-muted-foreground">
          API:{" "}
          <code className="rounded-md bg-card px-2 py-1 font-mono text-[0.7rem] text-muted-foreground ring-1 ring-border">
            {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
          </code>
        </p>
      </main>
    </AuthShell>
  );
}
