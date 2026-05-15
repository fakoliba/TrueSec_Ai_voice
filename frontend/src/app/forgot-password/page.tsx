"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { AuthShell } from "@/components/ui/AuthShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const trimmed = email.trim().toLowerCase();
      const data = await forgotPassword(trimmed);
      setMessage(data.message);
      if (data.reset_token) {
        router.push(`/reset-password?token=${encodeURIComponent(data.reset_token)}`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <main className="w-full max-w-sm">
        <p className="mb-2 text-center text-sm font-medium uppercase tracking-wider text-primary">trueSecAI</p>
        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground">Forgot password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Enter your email. If an account exists, you&apos;ll be taken to set a new password.
        </p>
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
                autoComplete="email"
                className={inputClassName}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && !error && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" disabled={loading} className="w-full justify-center font-semibold">
              {loading ? "Sending…" : "Continue"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </Card>
      </main>
    </AuthShell>
  );
}
