"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";
import { AuthShell } from "@/components/ui/AuthShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "1") setRegistered(true);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      if (typeof window !== "undefined") {
        localStorage.setItem("token", data.access_token);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <main className="w-full max-w-sm">
        <p className="mb-2 text-center text-sm font-medium uppercase tracking-wider text-primary">trueSecAI</p>
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-foreground">Sign in</h1>
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            {registered && (
              <p className="text-sm font-medium text-emerald-600">Account created. Sign in below.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full justify-center font-semibold">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
          <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <a href="mailto:truesecai@truesecai.com" className="font-medium text-primary hover:underline">
              Contact us
            </a>
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/" className="text-muted-foreground hover:text-primary hover:underline">
              ← Back to home
            </Link>
          </p>
        </Card>
      </main>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <main className="w-full max-w-sm">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading…</p>
            </Card>
          </main>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
