"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AiChatPanel } from "@/components/business/AiChatPanel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function TranslucentStar({ className, large }: { className?: string; large?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn(
        "shrink-0 text-primary opacity-40 drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]",
        large ? "h-10 w-10" : "h-5 w-5",
        className,
      )}
    >
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  );
}

type ChatDockContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const ChatDockContext = createContext<ChatDockContextValue | null>(null);

export function useBusinessChatDock(): ChatDockContextValue {
  const ctx = useContext(ChatDockContext);
  if (!ctx) {
    throw new Error("useBusinessChatDock must be used within BusinessChatDockProvider");
  }
  return ctx;
}

export function useBusinessChatDockOptional(): ChatDockContextValue | null {
  return useContext(ChatDockContext);
}

export function BusinessChatDockProvider({
  businessId,
  children,
}: {
  businessId: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ open, close, isOpen }),
    [open, close, isOpen],
  );

  return (
    <ChatDockContext.Provider value={value}>
      {children}
      <BusinessChatDockInner businessId={businessId} isOpen={isOpen} onClose={close} onOpen={open} />
    </ChatDockContext.Provider>
  );
}

function BusinessChatDockInner({
  businessId,
  isOpen,
  onClose,
  onOpen,
}: {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      {!isOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-4 py-2 shadow-[0_-2px_12px_rgba(0,0,0,0.25)] backdrop-blur-md md:left-56"
          role="region"
          aria-label="Team help"
        >
          <div className="flex justify-end pr-1 md:pr-4">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="min-w-[180px] font-semibold shadow-md shadow-primary/20"
              onClick={onOpen}
            >
              <TranslucentStar className="mr-2" />
              Open team help
            </Button>
          </div>
        </div>
      )}

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50 md:left-56"
            aria-label="Close chat overlay"
            onClick={onClose}
          />
          <div
            className="fixed bottom-0 right-0 z-[70] flex max-h-[min(70vh,560px)] w-full max-w-md flex-col rounded-tl-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md md:bottom-4 md:mr-4 md:max-h-[min(75vh,600px)] md:rounded-2xl md:border md:shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-help-dock-title"
          >
            <div className="relative flex items-center justify-between border-b border-border px-4 py-3">
              <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
                <TranslucentStar large />
              </div>
              <h2 id="team-help-dock-title" className="relative z-[1] text-sm font-semibold text-foreground">
                Team help
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="relative z-[1] rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <AiChatPanel businessId={businessId} className="min-h-[240px]" />
          </div>
        </>
      )}
    </>
  );
}
