"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// AI assistant — a chat over the account's LIVE data. The server
// (POST /api/ai/chat) scopes what the model can see to this account's role
// (operator → their tenant, parent → their family, platform → platform-wide)
// and answers via Groq; the browser only ever sends the conversation.
// Read-only by design: the assistant points at the right screen for actions.
// ─────────────────────────────────────────────────────────────────────────

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS: Record<string, string[]> = {
  operator: [
    "Who's booked in today?",
    "How full are my upcoming sessions?",
    "Which families still owe money?",
    "How were bookings this week?",
  ],
  staff: [
    "Who's expected in today?",
    "What sessions are running this week?",
    "What tasks are still open?",
  ],
  parent: [
    "What have my children got coming up?",
    "Do I owe anything at the moment?",
    "Do I have any store credit?",
  ],
  platform: [
    "How many providers are on the platform?",
    "How are bookings split by status?",
    "Who joined recently?",
  ],
};

export function AiAssistant({ kind }: { kind: keyof typeof STARTERS }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setDraft("");
    // The server reads the last 20 turns; trim client-side to match.
    const history = [...msgs, { role: "user" as const, content: q }].slice(-20);
    setMsgs(history);
    setBusy(true);
    try {
      const { reply } = await post<{ reply: string }>("/api/ai/chat", { messages: history });
      setMsgs([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setError((e as Error).message);
      setDraft(q); // let them retry without retyping
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-[760px] flex-col pt-2 text-[var(--ink)]">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          AI assistant
        </h2>
        <span className="text-[11.5px] text-[var(--ink-3)]">Answers from your live data · can't take actions</span>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="mx-auto max-w-[440px] pt-10 text-center">
              <div className="text-[28px]">✦</div>
              <p className="mt-2 text-[13.5px] font-bold">Ask about your day in plain English.</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
                The assistant reads the same live data as your screens — it never sees anyone
                else's, and it can't book, cancel or refund anything.
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-2">
                {STARTERS[kind].map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="cursor-pointer rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-[12.5px] text-[var(--ink-2)] transition-colors hover:border-[var(--brand)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--brand-soft)] px-3.5 py-2 text-[13px] text-[var(--brand-ink)]"
                      : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[13px] leading-relaxed text-[var(--ink)]"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[13px] text-[var(--ink-3)]">
                  Reading your live data…
                </div>
              </div>
            )}
            {error && <div className="text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
          </div>
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-[var(--line)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything — bookings, spaces, who's in, what's owed…"
            className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            disabled={busy}
            autoFocus
          />
          <Button type="submit" variant="solid" disabled={busy || !draft.trim()}>
            Send
          </Button>
        </form>
      </Card>
    </div>
  );
}
