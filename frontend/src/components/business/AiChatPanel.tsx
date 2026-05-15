"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn, inputClassName } from "@/lib/utils";

type Message = { role: string; content: string };

type AiChatPanelProps = {
  businessId: string;
  className?: string;
};

export function AiChatPanel({ businessId, className }: AiChatPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const text = input.trim();
    if (!text || !token) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await apiFetch("/api/businesses/" + businessId + "/conversations", {
        method: "POST",
        token,
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId ?? undefined,
          channel: "internal_help",
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to send");
      const data = (await res.json()) as { reply: string; conversation_id: number };
      setConversationId(data.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [businessId, conversationId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Ask how to use the dashboard (e.g. adding users, settings). Customer booking and intake are
            on the phone line.
          </p>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "ml-6 border border-primary/30 bg-primary/15 text-foreground"
                  : "mr-6 border border-border bg-card text-foreground shadow-sm",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {loading && (
            <div className="mr-6 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
              <p className="text-sm text-muted-foreground">Thinking…</p>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
        className="border-t border-border bg-background p-3"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className={cn(inputClassName, "flex-1 py-2 text-sm")}
            disabled={loading}
          />
          <Button type="submit" variant="primary" size="md" disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
