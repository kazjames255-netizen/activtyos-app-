"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { QuestionFields, unansweredRequired } from "@/components/QuestionFields";
import { uploadPlan, PLAN_MAX_BYTES } from "@/features/listings/planUpload";
import { squareAvatar, CHILD_LIMITS, ageOn } from "@/features/listings/checkout";
import { asksEveryBooking, dobRequired, limitFor, questionsFor, useTenantSettings } from "@/lib/settings";

export interface Child {
  id: string;
  name: string;
  age?: number;
  dob?: string;
  sex?: string;
  school?: string;
  allergies?: string;
  medical?: string;
  dietary?: string;
  send?: string;
  /** An uploaded SEND / EHCP plan — the stored file's id and the name it came
   *  in under. The bytes live in storage (see planUpload), not on the record. */
  sendPlanId?: string;
  sendPlanName?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  likes?: string;
  dislikes?: string;
  collectionPassword?: string;
  photoConsent?: boolean;
  photo?: string;
  /** Answers to the provider's own child questions, keyed by question id. */
  answers?: Record<string, string>;
}

function Avatar({ child, size = 44, accent }: { child: Pick<Child, "name" | "photo">; size?: number; accent?: string }) {
  if (child.photo) {
    return (
      // Inline data-URL avatar — next/image adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={child.photo}
        alt={child.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size, boxShadow: accent ? `0 0 0 2.5px ${accent}33` : undefined }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: accent ? `linear-gradient(140deg, ${accent}, ${accent}cc)` : "var(--brand-soft)",
      }}
    >
      {child.name ? child.name[0].toUpperCase() : "?"}
    </div>
  );
}

// A rotating set of friendly accents so a list of children isn't a wall of grey.
const ACCENTS = ["#2f6bd8", "#0f9488", "#7a5af8", "#e0692a", "#d6336c", "#0ea5e9"];

// A bigger, capped free-text box with a live character count.
function Area({
  label, value, onChange, max, placeholder, rows = 3,
}: { label: React.ReactNode; value: string; onChange: (v: string) => void; max: number; placeholder?: string; rows?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[10px] tabular-nums" style={{ color: value.length >= max ? "var(--red)" : "var(--ink-3)" }}>{value.length}/{max}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]"
      />
    </div>
  );
}

// A key-info pill on the child card, styled like the manual's safeguarding flags.
function Flag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-lg px-2.5 py-[3px] text-[10.5px] font-bold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function ChildModal({ child, tenantId, defaultCollectionPassword, onDone }: { child?: Child; tenantId?: string; defaultCollectionPassword?: string; onDone: (changed: boolean) => void }) {
  const editing = !!child;
  // The provider's settings + custom questions. A parent has no tenant of their
  // own, so this reads the provider's public slice (see useTenantSettings). It
  // falls back to the defaults — every field on — until it loads, so the base
  // fields always render and the form never blanks out.
  const { settings, questions } = useTenantSettings(tenantId);

  const [name, setName] = useState(child?.name ?? "");
  const [dob, setDob] = useState(child?.dob ?? "");
  const [sex, setSex] = useState<"boy" | "girl" | "">((child?.sex as "boy" | "girl") ?? "");
  // School is no longer a built-in question (a provider can add it as their own
  // custom question). Preserve any value already on the record, but don't ask.
  const [school] = useState(child?.school ?? "");
  const [allergies, setAllergies] = useState(child?.allergies ?? "");
  const [medical, setMedical] = useState(child?.medical ?? "");
  // Dietary is captured via the provider's "Dietary requirements" question now,
  // not a built-in box — but preserve any value already on the record.
  const dietary = child?.dietary ?? "";
  const [send, setSend] = useState(child?.send ?? "");
  const [sendPlanId, setSendPlanId] = useState<string | null>(child?.sendPlanId ?? null);
  const [sendPlanName, setSendPlanName] = useState<string | null>(child?.sendPlanName ?? null);
  // Yes/No gate for SEND — so a parent typing "no" in a free-text box can't
  // accidentally trigger the plan-upload prompt. null = not answered yet.
  const [hasSend, setHasSend] = useState<boolean | null>(child?.send || child?.sendPlanId ? true : null);
  const [emergencyName, setEmergencyName] = useState(child?.emergencyName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(child?.emergencyPhone ?? "");
  const [likes, setLikes] = useState(child?.likes ?? "");
  const [dislikes, setDislikes] = useState(child?.dislikes ?? "");
  // A new child inherits the family's existing collection PIN/word (same for
  // all their children) — editable, in case one child differs.
  const [collectionPassword, setCollectionPassword] = useState(child?.collectionPassword ?? defaultCollectionPassword ?? "");
  const pinPrefilled = !child && !!defaultCollectionPassword;
  const [photoConsent, setPhotoConsent] = useState(child?.photoConsent ?? false);
  const [photo, setPhoto] = useState<string | null>(child?.photo ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(child?.answers ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);
  const [planPct, setPlanPct] = useState<number | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // The family-level emergency contact (captured once with the parent's own
  // details) pre-fills a NEW child's emergency contact — it's the same across
  // children. Editable, in case one child needs a different contact.
  useEffect(() => {
    if (editing) return;
    apiGet<{ emergencyName?: string; emergencyPhone?: string }>("/api/account")
      .then((p) => {
        if (p.emergencyName) setEmergencyName((v) => v || p.emergencyName!);
        if (p.emergencyPhone) setEmergencyPhone((v) => v || p.emergencyPhone!);
      })
      .catch(() => {});
  }, [editing]);

  // The provider's own "once" questions — the stable ones asked when a child is
  // set up (the every-booking ones are asked on the booking itself). Age-gated
  // ones only appear once we know the child's age from their date of birth.
  const today = new Date().toISOString().slice(0, 10);
  const askQuestions = questionsFor(questions, undefined, ageOn(dob, today)).filter((q) => !asksEveryBooking(q));
  const needDob = dobRequired(settings, questions).required;
  const pinMode = settings.collectionCheck === "pin";

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await squareAvatar(file));
    } catch {
      setError("Couldn't read that image — try another file.");
    }
  }

  async function pickPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > PLAN_MAX_BYTES) {
      setPlanError(`${file.name} is ${Math.round(file.size / 1_000_000)}MB — the limit is ${PLAN_MAX_BYTES / 1_000_000}MB.`);
      return;
    }
    setPlanError(null);
    setPlanPct(0);
    try {
      const ref = await uploadPlan(file, setPlanPct);
      setSendPlanId(ref.id);
      setSendPlanName(ref.name);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "That upload didn't finish — try again.");
    } finally {
      setPlanPct(null);
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      name: name.trim(),
      ...(dob.trim() ? { dob: dob.trim() } : {}),
      ...(sex ? { sex } : {}),
      ...(school.trim() ? { school: school.trim() } : {}),
      ...(allergies.trim() ? { allergies: allergies.trim() } : {}),
      ...(medical.trim() ? { medical: medical.trim() } : {}),
      ...(dietary.trim() ? { dietary: dietary.trim() } : {}),
      ...(send.trim() ? { send: send.trim() } : {}),
      ...(sendPlanId ? { sendPlanId, ...(sendPlanName ? { sendPlanName } : {}) } : {}),
      ...(emergencyName.trim() ? { emergencyName: emergencyName.trim() } : {}),
      ...(emergencyPhone.trim() ? { emergencyPhone: emergencyPhone.trim() } : {}),
      ...(likes.trim() ? { likes: likes.trim() } : {}),
      ...(dislikes.trim() ? { dislikes: dislikes.trim() } : {}),
      ...(collectionPassword.trim() ? { collectionPassword: collectionPassword.trim() } : {}),
      ...(Object.keys(answers).length ? { answers } : {}),
      photoConsent,
      ...(photo ? { photo } : {}),
    };
    try {
      if (editing) {
        await api(`/api/my/children/${encodeURIComponent(child!.id)}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiPost("/api/my/children", body);
      }
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  const slideWrap = "w-full flex-none px-5 py-4 flex flex-col gap-3.5";

  // Compulsory: a name, a date of birth (unless the provider made it optional
  // and nothing age-gated needs it), and — when the provider asks gender — a
  // choice of boy/girl. Everything else on this slide is optional.
  const canLeaveAbout = !!name.trim() && (!!dob.trim() || !needDob) && (!settings.collectGender || !!sex);
  const emergencyOk = !!emergencyName.trim() && !!emergencyPhone.trim();
  const missingQuestions = unansweredRequired(askQuestions, answers);
  const questionsOk = missingQuestions.length === 0;

  // The slideshow, built to match what this provider actually asks: the
  // questions slide only appears when they have some, and the safeguarding
  // slide only when there's a collection check or a photo-consent question.
  const slides: {
    key: string; emoji: string; title: string; sub: string; ok: boolean; hint?: string; body: React.ReactNode;
  }[] = [
    {
      key: "about",
      emoji: "🧒",
      title: "About your child",
      sub: "The basics for the register.",
      ok: canLeaveAbout,
      hint: "A name" + (needDob ? ", date of birth" : "") + (settings.collectGender ? " and boy or girl" : "") + " are needed to continue.",
      body: (
        <>
          {settings.collectPhoto && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex h-[56px] w-[56px] flex-none items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--panel)] text-[22px] text-[var(--ink-2)]" aria-label="Upload photo">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : "+"}
              </button>
              <div className="min-w-0 flex-1">
                <Button type="button" onClick={() => fileRef.current?.click()}>{photo ? "Change photo" : "Add a photo"}</Button>
                <div className="mt-1 text-[11px] leading-[1.45] text-[var(--ink-3)]">Optional — goes on the register so staff know who they&rsquo;re greeting and handing over.</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
            </div>
          )}
          <div>
            <FieldLabel>Full name <span className="text-[var(--red)]">*</span></FieldLabel>
            <Input required placeholder="Child’s name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </div>
          <div>
            <FieldLabel>Date of birth {needDob ? <span className="text-[var(--red)]">*</span> : <span className="font-normal text-[var(--ink-3)]">— optional</span>}</FieldLabel>
            <Input required={needDob} type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full" />
          </div>
          {settings.collectGender && (
            <div>
              <FieldLabel>Boy or girl <span className="text-[var(--red)]">*</span></FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {([["boy", "👦 Boy"], ["girl", "👧 Girl"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setSex(sex === v ? "" : v)} className="rounded-xl border p-2.5 text-[12.5px] font-extrabold"
                    style={sex === v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">Used on the register and to colour their name in the provider&rsquo;s list.</div>
            </div>
          )}
        </>
      ),
    },
    {
      key: "health",
      emoji: "🩹",
      title: "Health & diet",
      sub: "Anything staff must know on day one.",
      ok: true,
      body: (
        <>
          <Area label="Allergies" placeholder="e.g. nuts — leave blank if none" value={allergies} onChange={setAllergies} max={limitFor(settings, "allergies", CHILD_LIMITS)} rows={2} />
          <Area label="Medical (e.g. asthma)" value={medical} onChange={setMedical} max={limitFor(settings, "medical", CHILD_LIMITS)} rows={2} />
          {/* Dietary is asked once via the provider's "Dietary requirements"
              question (seeded, replaces:"dietary") — not a second built-in box. */}
          {settings.collectSend && (
            <div>
              <div className="mb-1 text-[12px] font-bold text-[var(--ink)]">Does your child have any SEND or additional needs?</div>
              <div className="flex gap-2">
                {([["No", false], ["Yes", true]] as const).map(([lbl, val]) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => {
                      setHasSend(val);
                      if (!val) { setSend(""); setSendPlanId(null); setSendPlanName(null); }
                    }}
                    className="flex-1 rounded-lg border-2 px-3 py-2 text-[12.5px] font-bold transition-colors"
                    style={hasSend === val
                      ? { borderColor: "var(--brand-2)", background: "var(--brand-soft,#eaf0fc)", color: "var(--brand-ink,#1d3a8f)" }
                      : { borderColor: "var(--line)", color: "var(--ink-2)" }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              {hasSend === true && (
              <div className="mt-2">
              <Area label={<>Tell us about their SEND / additional needs</>} placeholder="Describe the support they need — e.g. autism, ADHD, 1:1 support, sensory needs" value={send} onChange={setSend} max={limitFor(settings, "send", CHILD_LIMITS)} rows={3} />
              {settings.collectSendPlan && (
                <div className="mt-2 rounded-lg border border-dashed border-[var(--line)] p-2.5">
                  <div className="text-[11px] font-bold">SEND or EHCP plan <span className="font-normal text-[var(--ink-3)]">— optional</span></div>
                  <div className="mt-0.5 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    If you have one, upload it so staff can read it before day one. PDF or image, up to {PLAN_MAX_BYTES / 1_000_000}MB.
                  </div>
                  {sendPlanId ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold">📎 {sendPlanName ?? "Plan attached"}</span>
                      <button type="button" onClick={() => { setSendPlanId(null); setSendPlanName(null); }} className="text-[11px] font-bold text-[var(--ink-3)]">Remove</button>
                    </div>
                  ) : planPct !== null ? (
                    <div className="mt-2">
                      <div className="text-[11.5px] font-bold">Uploading… {Math.round(planPct * 100)}%</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                        <div className="h-full rounded-full bg-[var(--brand-2)]" style={{ width: `${planPct * 100}%` }} />
                      </div>
                    </div>
                  ) : (
                    <Button type="button" onClick={() => planRef.current?.click()} className="mt-2">📎 Choose a file to upload</Button>
                  )}
                  {!sendPlanId && (
                    <input ref={planRef} type="file" accept="application/pdf,image/*" onChange={pickPlan} className="hidden" />
                  )}
                  {planError && <div className="mt-1.5 text-[11px] font-bold text-[var(--red)]">{planError}</div>}
                </div>
              )}
              </div>
              )}
            </div>
          )}
        </>
      ),
    },
    {
      key: "contact",
      emoji: "💛",
      title: "Contact & comfort",
      sub: "Who to call, and what settles them.",
      ok: emergencyOk,
      hint: "An emergency contact — a name and number — is required.",
      body: (
        <>
          <div>
            <FieldLabel>Emergency contact <span className="text-[var(--red)]">*</span></FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full" style={emergencyName.trim() ? undefined : { borderColor: "#f0b8b8" }} />
              <Input placeholder="Phone" inputMode="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full" style={emergencyPhone.trim() ? undefined : { borderColor: "#f0b8b8" }} />
            </div>
            <div className="mt-1 text-[11px] text-[var(--ink-3)]">Required — who staff ring if they can&rsquo;t reach you.</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Area label="Likes" placeholder="What settles them" value={likes} onChange={setLikes} max={limitFor(settings, "likes", CHILD_LIMITS)} rows={2} />
            <Area label="Dislikes" placeholder="What to avoid" value={dislikes} onChange={setDislikes} max={limitFor(settings, "dislikes", CHILD_LIMITS)} rows={2} />
          </div>
        </>
      ),
    },
    ...(askQuestions.length
      ? [{
          key: "questions",
          emoji: "📝",
          title: "A few questions",
          sub: "Asked once by your provider.",
          ok: questionsOk,
          hint: "Please answer the required questions to continue.",
          body: (
            // Operator theme (CSS vars) — no `tone`, so QuestionFields renders
            // its default variant, matching the rest of this form.
            <QuestionFields questions={askQuestions} answers={answers} onChange={setAnswers} />
          ),
        }]
      : []),
    ...(settings.collectionCheck !== "off" || settings.askPhotoConsent
      ? [{
          key: "safeguarding",
          emoji: "🔒",
          title: "Safeguarding",
          sub: "Collection and photo permission.",
          ok: true,
          body: (
            <>
              {settings.collectionCheck !== "off" && (
                <div>
                  <FieldLabel>Collection {pinMode ? "PIN" : "password"}</FieldLabel>
                  <div className="mb-1 text-[11px] leading-[1.45] text-[var(--ink-3)]">
                    Pick {pinMode ? "a number" : "a word"} only your family knows. If <b className="text-[var(--ink-2)]">anyone other than you</b>{" "}
                    comes to collect them, staff will ask for it and won&rsquo;t hand over without it. Staff can see this {pinMode ? "PIN" : "word"}, so don&rsquo;t reuse a password from anywhere else.
                  </div>
                  <Input value={collectionPassword} onChange={(e) => setCollectionPassword(e.target.value)}
                    maxLength={CHILD_LIMITS.collectionPassword} inputMode={pinMode ? "numeric" : undefined}
                    placeholder={pinMode ? "e.g. 4816" : "e.g. Bluebell"} className="w-full" />
                  {pinPrefilled && (
                    <div className="mt-1 text-[10.5px] font-semibold text-[var(--brand-ink,#1d3a8f)]">
                      ✓ Same {pinMode ? "PIN" : "word"} as your other children — change it if this one&rsquo;s different.
                    </div>
                  )}
                </div>
              )}
              {settings.askPhotoConsent && (
                <div>
                  <FieldLabel>Photo permission</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: true, label: "Photos allowed", desc: "May appear in Moments & newsfeed" },
                      { v: false, label: "No photos", desc: "Never photographed or shared" },
                    ].map((opt) => (
                      <button key={String(opt.v)} type="button" onClick={() => setPhotoConsent(opt.v)} className="rounded-xl border p-2.5 text-left"
                        style={photoConsent === opt.v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                        <div className="text-[12.5px] font-extrabold" style={{ color: photoConsent === opt.v ? "var(--brand-ink)" : "var(--ink)" }}>
                          {opt.v ? "📷 " : "🚫 "}{opt.label}
                        </div>
                        <div className="text-[11px]" style={{ color: photoConsent === opt.v ? "var(--brand-strong)" : "var(--ink-3)" }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ),
        }]
      : []),
  ];

  const last = slides.length - 1;
  const [step, setStep] = useState(0);
  // A slide the wizard has grown past can leave the current one stranded on an
  // index that no longer exists (a provider config that drops a slide). Clamp.
  const safeStep = Math.min(step, last);
  const canNext = slides[safeStep].ok;
  const canSave = canLeaveAbout && emergencyOk && questionsOk;
  const next = () => canNext && setStep((s) => Math.min(last, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onDone(false)}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto px-3.5 py-8"
      style={{ background: "rgba(12,18,40,.55)", backdropFilter: "blur(3px)" }}
    >
      <div className="w-full max-w-[600px] overflow-hidden rounded-2xl bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_-12px_rgba(20,30,60,.55)]">
        {/* Branded header + progress — matches the welcome onboarding card. */}
        <div className="relative px-6 py-5 text-white" style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 70%,#5a93f0 100%)" }}>
          <button type="button" onClick={() => onDone(false)} aria-label="Close"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold leading-none hover:bg-white/30">×</button>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
            {editing ? `Edit ${child!.name || "child"}` : "Add a child"} · Step {safeStep + 1} of {slides.length}
          </div>
          <h3 className="m-0 mt-0.5 text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {slides[safeStep].emoji} {slides[safeStep].title}
          </h3>
          <div className="text-[12px] text-white/85">{slides[safeStep].sub}</div>
          {/* segmented progress bar */}
          <div className="mt-3 flex gap-1.5">
            {slides.map((s, i) => (
              <button key={s.key} type="button" onClick={() => (i < safeStep || (i === safeStep + 1 && canNext) ? setStep(i) : undefined)}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= safeStep ? "#ffffff" : "rgba(255,255,255,.3)" }} aria-label={`Go to ${s.title}`} />
            ))}
          </div>
        </div>

        {/* slides — swipe horizontally as you complete each */}
        <div className="overflow-hidden">
          <div className="flex items-start transition-transform duration-300 ease-out" style={{ transform: `translateX(-${safeStep * 100}%)` }}>
            {slides.map((s, i) => (
              // Inactive slides collapse to zero height so the card is only as
              // tall as the CURRENT step — not the tallest one.
              <div key={s.key} className={`${slideWrap} ${safeStep === i ? "" : "max-h-0 overflow-hidden py-0"}`} aria-hidden={safeStep !== i}>
                {s.body}
              </div>
            ))}
          </div>
        </div>

        {/* footer nav */}
        <div className="border-t border-[var(--line)] bg-[var(--panel)] px-6 py-3.5">
          {error && <div className="mb-2 text-[12.5px] text-[var(--red)]">{error}</div>}
          {!slides[safeStep].ok && slides[safeStep].hint && (
            <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">{slides[safeStep].hint}</div>
          )}
          <div className="flex items-center gap-2">
            {safeStep > 0 && (
              <button type="button" onClick={back}
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]">
                ← Back
              </button>
            )}
            {(() => {
              const isLast = safeStep >= last;
              const disabled = isLast ? (busy || !canSave) : !canNext;
              return (
                <button type="button" onClick={() => (isLast ? save() : next())} disabled={disabled}
                  className="ml-auto rounded-full px-5 py-2.5 text-[14px] font-extrabold text-white transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", boxShadow: "0 4px 14px -3px rgba(47,107,216,.6)" }}>
                  {isLast ? (busy ? "Saving…" : editing ? "Save changes" : "Save child") : "Next →"}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/** custdash/children — the family's child profiles (used at booking time). */
export function ChildrenApp() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  // Phase 1 is single-provider: the family's one provider, so the Add/Edit form
  // can read that provider's settings + custom child questions.
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  // Which children already have a booking on record — those can't be removed,
  // so the register/booking history stays intact.
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [bookedNames, setBookedNames] = useState<Set<string>>(new Set());

  // Deep-link straight into the Add-a-child form (e.g. from the welcome popup's
  // "Add my children" button → /custdash/children?add=1).
  const addParam = useSearchParams().get("add");
  useEffect(() => { if (addParam === "1") setAdding(true); }, [addParam]);

  const refresh = useCallback(() => {
    apiGet<Child[]>("/api/my/children")
      .then(setChildren)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load children"));
    apiGet<{ child?: string; childId?: string }[]>("/api/my/bookings")
      .then((bs) => {
        setBookedIds(new Set(bs.map((b) => b.childId).filter((x): x is string => !!x)));
        setBookedNames(new Set(bs.map((b) => (b.child ?? "").trim().toLowerCase()).filter(Boolean)));
      })
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["children", "bookings"], refresh);

  useEffect(() => {
    apiGet<{ tenantId: string }[]>("/api/my/providers")
      .then((ps) => { if (ps[0]) setTenantId(ps[0].tenantId); })
      .catch(() => {});
  }, []);

  const hasBookings = useCallback(
    (c: Child) => bookedIds.has(c.id) || bookedNames.has(c.name.trim().toLowerCase()),
    [bookedIds, bookedNames],
  );

  async function remove(c: Child) {
    if (hasBookings(c)) return; // guarded at the UI too — belt and braces
    if (!confirm(`Remove ${c.name}? This can’t be undone.`)) return;
    try {
      await api(`/api/my/children/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    }
  }

  if (error && !children) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!children)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[11.5px] font-bold text-[var(--brand-strong)]">
            Profiles
          </span>
          <h2 className="mt-2 text-[26px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>
            My <span style={{ color: "var(--brand-strong)" }}>{children.length === 1 ? "child" : "children"}</span>
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Profiles, medical &amp; dietary notes and safeguarding flags.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full px-4 py-2.5 text-[13px] font-bold text-white shadow-sm"
          style={{ background: "#157347" }}
        >
          + Add child
        </button>
      </div>

      {error && <div className="mb-3 text-[12.5px] text-[var(--red)]">{error}</div>}

      {adding && (
        <ChildModal
          tenantId={tenantId}
          defaultCollectionPassword={(children ?? []).map((c) => c.collectionPassword).find((p) => !!p?.trim()) ?? ""}
          onDone={(changed) => {
            setAdding(false);
            if (changed) refresh();
          }}
        />
      )}
      {editing && (
        <ChildModal
          child={editing}
          tenantId={tenantId}
          onDone={(changed) => {
            setEditing(null);
            if (changed) refresh();
          }}
        />
      )}

      {children.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          No children saved yet — add them once and booking gets faster.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((c, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            const clean = !c.allergies && !c.medical && !c.dietary && !c.send;
            return (
              <div
                key={c.id}
                data-ui="card"
                className="group relative flex overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(20,30,60,.4)]"
              >
                {/* accent spine */}
                <span className="w-1.5 flex-none" style={{ background: accent }} />
                <div className="flex-1 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar child={c} size={46} accent={accent} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15.5px] font-extrabold leading-tight">{c.name}</div>
                      <div className="text-[11.5px] text-[var(--ink-3)]">
                        {[c.age !== undefined ? `Age ${c.age}` : null, c.school].filter(Boolean).join(" · ") || "Tap Edit to add details"}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-3 text-[12px] font-bold">
                      <button type="button" onClick={() => setEditing(c)} className="rounded-full px-3 py-1 text-white" style={{ background: accent }}>Edit</button>
                      {hasBookings(c) ? (
                        <span
                          title="This child has bookings on record, so their profile can’t be removed."
                          className="flex cursor-not-allowed items-center gap-1 text-[var(--ink-3)] opacity-60"
                        >
                          🔒 Remove
                        </span>
                      ) : (
                        <button type="button" onClick={() => remove(c)} className="text-[var(--ink-3)] hover:text-[var(--red)]">Remove</button>
                      )}
                    </div>
                  </div>
                  {/* Key info pulled to the front — allergies, medical, diet, SEND. */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {c.allergies && <Flag bg="rgba(245,158,11,.14)" fg="#b26a00">⚠ Allergy: {c.allergies}</Flag>}
                    {c.medical && <Flag bg="rgba(239,68,68,.14)" fg="#c0392b">{c.medical}</Flag>}
                    {c.dietary && <Flag bg="rgba(20,184,166,.14)" fg="#0f766e">{c.dietary}</Flag>}
                    {c.send && <Flag bg="rgba(122,90,248,.14)" fg="#6a4fd0">SEND: {c.send}</Flag>}
                    <Flag bg={c.photoConsent ? "rgba(21,179,100,.14)" : "rgba(120,126,142,.14)"} fg={c.photoConsent ? "#1d3a8f" : "var(--ink-3)"}>
                      {c.photoConsent ? "📷 Photos OK" : "🚫 No photos"}
                    </Flag>
                    {clean && <Flag bg="rgba(120,126,142,.1)" fg="var(--ink-3)">No medical or dietary flags</Flag>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
