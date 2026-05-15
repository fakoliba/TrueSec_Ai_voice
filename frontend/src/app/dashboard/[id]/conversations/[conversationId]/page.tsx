"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getBusinessConversation } from "@/lib/api";
import type { Conversation } from "@/lib/api";
import { cn } from "@/lib/utils";

function parseMessages(raw: unknown): { role: string; content: string; timestamp?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    if (m && typeof m === "object" && "content" in m) {
      const o = m as Record<string, unknown>;
      return {
        role: typeof o.role === "string" ? o.role : "user",
        content: typeof o.content === "string" ? o.content : String(o.content ?? ""),
        timestamp: typeof o.timestamp === "string" ? o.timestamp : undefined,
      };
    }
    return { role: "user", content: "" };
  });
}

export default function ConversationTranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;
  const conversationId = params.conversationId as string;
  const [conv, setConv] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setError(null);
    getBusinessConversation(Number(businessId), Number(conversationId))
      .then(setConv)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load conversation"),
      );
  }, [businessId, conversationId, router]);

  const messages = conv ? parseMessages(conv.messages) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-muted-foreground">
        <Link href={`/dashboard/${businessId}/activity`} className="text-primary hover:underline">
          ← Call activity
        </Link>
      </p>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">AI conversation transcript</h1>
      {conv && (
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="capitalize">{conv.channel}</span> · Updated {new Date(conv.updated_at).toLocaleString()}
          {conv.intent ? (
            <>
              {" "}
              · Intent: <span className="text-foreground">{conv.intent}</span>
            </>
          ) : null}
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      )}

      {!error && !conv && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

      {conv && (
        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-4 ring-1 ring-border/20">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No messages in this conversation.</p>
          ) : (
            messages.map((m, i) => (
              <div key={i}>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {m.role === "assistant" ? "AI" : m.role === "user" ? "Customer" : m.role}
                  {m.timestamp ? (
                    <span className="ml-2 font-normal normal-case text-muted-foreground/80">
                      {new Date(m.timestamp).toLocaleString()}
                    </span>
                  ) : null}
                </p>
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    m.role === "user" || m.role === "caller"
                      ? "ml-4 border border-primary/30 bg-primary/15 text-foreground"
                      : "mr-4 border border-border bg-background text-foreground shadow-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
