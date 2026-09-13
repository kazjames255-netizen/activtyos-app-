"use client";

// The referee's page (/reference/{token}) — the one part of ActivityOS a person
// with no account ever fills in. No sign-in, no chrome, no navigation: the
// unguessable token in the link is the authorisation, exactly like the invoice
// pay page. Single-use — once submitted or declined the link 410s, so a
// forwarded email can't overwrite what was said.
import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { ReferenceQuestionForm } from "./ReferenceAnswers";
import { DEFAULT_REFERENCE_SECTIONS, missingAnswers, type RefSection } from "./referenceQuestions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
// Firestore caps a document at 1MB and the answers share it — see MAX_FILE_CHARS
// in server/src/routes/references.ts. Checked here too so the referee is told
// before they wait for an upload that will bounce.
const MAX_FILE_CHARS = 700_000;

interface Preview {
  tenantName: string;
  candidateName: string;
  jobTitle: string | null;
  refereeName: string;
  refereeOrg: string | null;
  /** The questions THIS request was created with — the provider may have edited
   *  their set since, which must not change what this referee is asked. */
  sections: RefSection[] | null;
}

async function publicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { "content-type": "application/json" }, ...init });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error((body as { error?: string })?.error ?? "Something went wrong — please try again.");
  return body as T;
}

export function ReferenceForm({ token }: { token: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [file, setFile] = useState<{ fileData: string; fileName: string } | null>(null);
  const [signedName, setSignedName] = useState("");
  const [signedPosition, setSignedPosition] = useState("");
  const [signedOrg, setSignedOrg] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"sent" | "declined" | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    publicJson<Preview>(`/api/public/reference/${encodeURIComponent(token)}`)
      .then((p) => { setPreview(p); setSignedName(p.refereeName); setSignedOrg(p.refereeOrg ?? ""); setAnswers((a) => ({ ...a, q_org: p.refereeOrg ?? "" })); })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  const set = useCallback((id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v })), []);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const data = String(r.result);
      if (data.length > MAX_FILE_CHARS) { setErr("That file is too big — please attach something under about 500KB, or just fill in the form."); return; }
      setErr(null);
      setFile({ fileData: data, fileName: f.name });
    };
    r.readAsDataURL(f);
  };

  async function submit() {
    // Everything compulsory, in one message — a referee shouldn't have to press
    // submit four times to discover four missing answers.
    const all = missingAnswers(sections, answers);
    if (!signedName.trim()) all.push("Your name");
    if (all.length) { setErr(`Still to answer: ${all.join(" · ")}`); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (!confirmed) { setErr("Please tick the box to confirm the reference is accurate."); return; }
    setBusy(true); setErr(null);
    try {
      await publicJson(`/api/public/reference/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ answers, file: file ?? undefined, signedName, signedPosition, signedOrg, confirmed: true }),
      });
      setDone("sent");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  async function decline() {
    setBusy(true); setErr(null);
    try {
      await publicJson(`/api/public/reference/${encodeURIComponent(token)}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason: declineReason }),
      });
      setDone("declined");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen px-4 py-8" style={{ ...LIGHT_PALETTE, background: "#f7f4ee" }}>
      <div className="mx-auto w-full max-w-[720px]">{children}</div>
    </div>
  );

  if (loadError) return shell(
    <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
      <div className="text-[34px]">📋</div>
      <h1 className="mt-2 text-[18px] font-extrabold text-[var(--ink)]">{loadError}</h1>
      <p className="mt-1.5 text-[13px] text-[var(--ink-3)]">If you think this is a mistake, reply to the email that brought you here and they&rsquo;ll send a fresh link.</p>
    </div>,
  );

  if (done) return shell(
    <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
      <div className="text-[34px]">{done === "sent" ? "✅" : "👍"}</div>
      <h1 className="mt-2 text-[19px] font-extrabold text-[var(--ink)]">
        {done === "sent" ? "Thank you — that's sent." : "Thanks for letting us know."}
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-3)]">
        {done === "sent"
          ? `Your reference has gone straight to ${preview?.tenantName ?? "the provider"}. Only their team can see it — you don't need to do anything else, and you can close this page.`
          : "The request is closed and you won't get any more reminders about it."}
      </p>
    </div>,
  );

  if (!preview) return shell(<div className="py-20 text-center text-[13px] text-[var(--ink-3)]">Loading…</div>);

  // Requests created before question sets were stored have no snapshot — fall
  // back to the defaults rather than showing a referee an empty form.
  const sections = preview.sections?.length ? preview.sections : DEFAULT_REFERENCE_SECTIONS;

  return shell(
    <>
      <header className="mb-4 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#b45309,#f59e0b)] p-6 text-white shadow-[0_18px_40px_-24px_rgba(120,60,0,.6)]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/80">Reference request · {preview.tenantName}</div>
        <h1 className="mt-1 text-[23px] font-extrabold leading-tight">A reference for {preview.candidateName}</h1>
        <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-white/90">
          {preview.candidateName} has applied to work with children at <b>{preview.tenantName}</b>
          {preview.jobTitle ? <> as <b>{preview.jobTitle}</b></> : null}, and gave your name as a referee.
          It&rsquo;s a few questions and takes about three minutes.
        </p>
      </header>

      <div className="mb-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[12px] leading-relaxed text-[var(--ink-2)] shadow-sm">
        <b className="text-[var(--ink)]">Before you start.</b> Please answer factually and fairly — what you write can be
        disclosed to {preview.candidateName} if they ask. Only {preview.tenantName}&rsquo;s recruiting team will see it, and
        it&rsquo;s kept with their staff record. If you&rsquo;d rather send a reference on your own headed paper, you can attach
        it at the bottom instead of writing much here.
      </div>

      {err && <div className="mb-3 rounded-xl border border-[#f3c2c2] bg-[#fdecec] px-4 py-3 text-[12.5px] font-semibold leading-snug text-[#a32020]">{err}</div>}

      <ReferenceQuestionForm sections={sections} answers={answers} set={set} />

      <section className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <header className="border-b border-[var(--line)] bg-[#fdf3e0] px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-[#8a4b09]">✍️ Your details</h2>
          <p className="mt-0.5 text-[11.5px] text-[#96632a]">Typing your name here is your signature.</p>
        </header>
        <div className="grid gap-2.5 p-4 sm:grid-cols-2">
          <label className="text-[12.5px] font-bold text-[var(--ink-2)]">Your name <span className="text-[#c0392b]">*</span>
            <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} className="mt-1 w-full bg-white" />
          </label>
          <label className="text-[12.5px] font-bold text-[var(--ink-2)]">Your position
            <Input value={signedPosition} onChange={(e) => setSignedPosition(e.target.value)} className="mt-1 w-full bg-white" />
          </label>
          <label className="text-[12.5px] font-bold text-[var(--ink-2)] sm:col-span-2">Organisation
            <Input value={signedOrg} onChange={(e) => setSignedOrg(e.target.value)} className="mt-1 w-full bg-white" />
          </label>
          <div className="sm:col-span-2">
            <div className="mb-1 text-[12.5px] font-bold text-[var(--ink-2)]">Reference on headed paper (optional)</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:border-[#b45309]">
                {file ? "Replace file" : "Attach a file"}
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              {file && <span className="text-[12px] font-bold text-[#8a4b09]">📎 {file.fileName}<button type="button" onClick={() => setFile(null)} className="ml-2 text-[var(--ink-3)] hover:text-[#c0392b]">remove</button></span>}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug text-[var(--ink-2)] sm:col-span-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-[#b45309]" />
            <span>I confirm the information above is accurate to the best of my knowledge, and that I&rsquo;m authorised to give this reference.</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3">
          <button type="button" onClick={() => setDeclining((v) => !v)} className="text-[12px] font-bold text-[var(--ink-3)] underline hover:text-[var(--ink-2)]">
            I can&rsquo;t give this reference
          </button>
          <Button variant="primary" className="ml-auto" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send the reference"}</Button>
        </div>
        {declining && (
          <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
            <div className="text-[12.5px] font-bold text-[var(--ink-2)]">That&rsquo;s absolutely fine.</div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]">
              Wrong person, company policy, or you don&rsquo;t know them well enough — closing the request here stops the reminder emails.
              A short note helps {preview.tenantName} ask someone else.
            </p>
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={2} placeholder="Optional — e.g. our HR team handles references" className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#b45309]" />
            <div className="mt-2 flex gap-2">
              <Button onClick={() => setDeclining(false)}>Back</Button>
              <Button variant="danger" disabled={busy} onClick={decline}>{busy ? "Closing…" : "Close this request"}</Button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-4 pb-8 text-center text-[11px] text-[var(--ink-3)]">
        Sent by {preview.tenantName} · powered by ActivityOS
      </p>
    </>,
  );
}
