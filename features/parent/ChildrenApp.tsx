"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

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
  emergencyName?: string;
  emergencyPhone?: string;
  likes?: string;
  dislikes?: string;
  collectionPassword?: string;
  photoConsent?: boolean;
  photo?: string;
}

// Client-side avatar: centre-crop + resize to 128px JPEG (~10KB) so it can
// live inline until the real file-storage milestone.
async function fileToAvatar(file: File): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const min = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.8);
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

// Character limits per free-text field — the capacity we agreed: long enough
// to explain a real need, short enough to keep registers and exports readable.
const LIMITS = { allergies: 140, medical: 140, dietary: 140, send: 200, likes: 80, dislikes: 80 } as const;

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

function ChildModal({ child, onDone }: { child?: Child; onDone: (changed: boolean) => void }) {
  const editing = !!child;
  const [name, setName] = useState(child?.name ?? "");
  const [dob, setDob] = useState(child?.dob ?? "");
  const [sex, setSex] = useState<"boy" | "girl" | "">((child?.sex as "boy" | "girl") ?? "");
  // School is no longer a built-in question (a provider can add it as their own
  // custom question). Preserve any value already on the record, but don't ask.
  const [school] = useState(child?.school ?? "");
  const [allergies, setAllergies] = useState(child?.allergies ?? "");
  const [medical, setMedical] = useState(child?.medical ?? "");
  const [dietary, setDietary] = useState(child?.dietary ?? "");
  const [send, setSend] = useState(child?.send ?? "");
  const [emergencyName, setEmergencyName] = useState(child?.emergencyName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(child?.emergencyPhone ?? "");
  const [likes, setLikes] = useState(child?.likes ?? "");
  const [dislikes, setDislikes] = useState(child?.dislikes ?? "");
  const [collectionPassword, setCollectionPassword] = useState(child?.collectionPassword ?? "");
  const [photoConsent, setPhotoConsent] = useState(child?.photoConsent ?? false);
  const [photo, setPhoto] = useState<string | null>(child?.photo ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await fileToAvatar(file));
    } catch {
      setError("Couldn't read that image — try another file.");
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      name: name.trim(),
      dob: dob.trim(),
      sex,
      ...(school.trim() ? { school: school.trim() } : {}),
      ...(allergies.trim() ? { allergies: allergies.trim() } : {}),
      ...(medical.trim() ? { medical: medical.trim() } : {}),
      ...(dietary.trim() ? { dietary: dietary.trim() } : {}),
      ...(send.trim() ? { send: send.trim() } : {}),
      ...(emergencyName.trim() ? { emergencyName: emergencyName.trim() } : {}),
      ...(emergencyPhone.trim() ? { emergencyPhone: emergencyPhone.trim() } : {}),
      ...(likes.trim() ? { likes: likes.trim() } : {}),
      ...(dislikes.trim() ? { dislikes: dislikes.trim() } : {}),
      ...(collectionPassword.trim() ? { collectionPassword: collectionPassword.trim() } : {}),
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

  // The slideshow: each section is a slide, finish one to swipe to the next.
  const STEPS = [
    { emoji: "🧒", title: "About your child", sub: "The basics for the register." },
    { emoji: "🩹", title: "Health & diet", sub: "Anything staff must know on day one." },
    { emoji: "💛", title: "Contact & comfort", sub: "Who to call, and what settles them." },
    { emoji: "🔒", title: "Safeguarding", sub: "Collection and photo permission." },
  ];
  const last = STEPS.length - 1;
  const [step, setStep] = useState(0);
  // Compulsory: name + date of birth (identity & age/ratios) and a reachable
  // emergency contact (safeguarding — a child can't be left with no one to
  // call). Everything else is optional. Gender isn't required — some providers
  // never ask it.
  const canLeaveAbout = !!name.trim() && !!dob.trim();
  const emergencyOk = !!emergencyName.trim() && !!emergencyPhone.trim();
  const canLeave = (s: number) => (s === 0 ? canLeaveAbout : s === 2 ? emergencyOk : true);
  const canNext = canLeave(step);
  const canSave = canLeaveAbout && emergencyOk;
  const next = () => canNext && setStep((s) => Math.min(last, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const slideWrap = "w-full flex-none px-5 py-4 flex flex-col gap-3.5";

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onDone(false)}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
    >
      <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        {/* header + progress */}
        <div className="border-b border-[var(--line)] px-5 pb-3.5 pt-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                {editing ? `Edit ${child!.name || "child"}` : "Add a child"} · Step {step + 1} of {STEPS.length}
              </div>
              <h3 className="m-0 mt-0.5 text-[17px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
                {STEPS[step].emoji} {STEPS[step].title}
              </h3>
              <div className="text-[11.5px] text-[var(--ink-3)]">{STEPS[step].sub}</div>
            </div>
            <button type="button" onClick={() => onDone(false)} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]" aria-label="Close">×</button>
          </div>
          {/* segmented progress bar */}
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((s, i) => (
              <button key={s.title} type="button" onClick={() => (i < step || (i === step + 1 && canNext) ? setStep(i) : undefined)}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= step ? "var(--brand-2)" : "var(--line)" }} aria-label={`Go to ${s.title}`} />
            ))}
          </div>
        </div>

        {/* slides — swipe horizontally as you complete each */}
        <div className="overflow-hidden">
          <div className="flex items-stretch transition-transform duration-300 ease-out" style={{ transform: `translateX(-${step * 100}%)` }}>
            {/* Slide 1 — about */}
            <div className={slideWrap} aria-hidden={step !== 0}>
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
              <div>
                <FieldLabel>Full name <span className="text-[var(--red)]">*</span></FieldLabel>
                <Input required placeholder="Child’s name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
              </div>
              <div>
                <FieldLabel>Date of birth <span className="text-[var(--red)]">*</span></FieldLabel>
                <Input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full" />
              </div>
              <div>
                <FieldLabel>Boy or girl <span className="font-normal text-[var(--ink-3)]">— optional</span></FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {([["boy", "Boy"], ["girl", "Girl"]] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setSex(v)} className="rounded-xl border p-2.5 text-[12.5px] font-extrabold"
                      style={sex === v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Slide 2 — health & diet */}
            <div className={slideWrap} aria-hidden={step !== 1}>
              <Area label="Allergies" placeholder="e.g. nuts — leave blank if none" value={allergies} onChange={setAllergies} max={LIMITS.allergies} rows={2} />
              <Area label="Medical (e.g. asthma)" value={medical} onChange={setMedical} max={LIMITS.medical} rows={2} />
              <Area label="Dietary needs" placeholder="e.g. vegetarian, halal" value={dietary} onChange={setDietary} max={LIMITS.dietary} rows={2} />
              <Area label={<>SEND / accessibility</>} placeholder="Describe the support they need" value={send} onChange={setSend} max={LIMITS.send} rows={3} />
            </div>

            {/* Slide 3 — contact & comfort */}
            <div className={slideWrap} aria-hidden={step !== 2}>
              <div>
                <FieldLabel>Emergency contact <span className="text-[var(--red)]">*</span></FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full" style={emergencyName.trim() ? undefined : { borderColor: "#f0b8b8" }} />
                  <Input placeholder="Phone" inputMode="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full" style={emergencyPhone.trim() ? undefined : { borderColor: "#f0b8b8" }} />
                </div>
                <div className="mt-1 text-[11px] text-[var(--ink-3)]">Required — who staff ring if they can&rsquo;t reach you.</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Area label="Likes" placeholder="What settles them" value={likes} onChange={setLikes} max={LIMITS.likes} rows={2} />
                <Area label="Dislikes" placeholder="What to avoid" value={dislikes} onChange={setDislikes} max={LIMITS.dislikes} rows={2} />
              </div>
            </div>

            {/* Slide 4 — safeguarding */}
            <div className={slideWrap} aria-hidden={step !== 3}>
              <div>
                <FieldLabel>Collection password</FieldLabel>
                <div className="mb-1 text-[11px] leading-[1.45] text-[var(--ink-3)]">
                  Pick a word only your family knows. If <b className="text-[var(--ink-2)]">anyone other than you</b>{" "}
                  comes to collect them, staff will ask for it and won&rsquo;t hand over without it. Staff can see this word, so don&rsquo;t reuse a password from anywhere else.
                </div>
                <Input placeholder="e.g. Bluebell" value={collectionPassword} onChange={(e) => setCollectionPassword(e.target.value)} className="w-full" />
              </div>
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
            </div>
          </div>
        </div>

        {/* footer nav */}
        <div className="border-t border-[var(--line)] px-5 py-3.5">
          {error && <div className="mb-2 text-[12.5px] text-[var(--red)]">{error}</div>}
          {step === 0 && !canLeaveAbout && (
            <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">A name and date of birth are needed to continue.</div>
          )}
          {step === 2 && !emergencyOk && (
            <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">An emergency contact — a name and number — is required.</div>
          )}
          <div className="flex items-center gap-2">
            {step > 0 && <Button type="button" onClick={back}>← Back</Button>}
            {step < last ? (
              <Button variant="primary" type="button" onClick={next} disabled={!canNext} className="ml-auto">
                Next →
              </Button>
            ) : (
              <Button variant="primary" type="button" onClick={() => save()} disabled={busy || !canSave} className="ml-auto">
                {busy ? "Saving…" : editing ? "Save changes" : "Save child"}
              </Button>
            )}
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
  // Which children already have a booking on record — those can't be removed,
  // so the register/booking history stays intact.
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [bookedNames, setBookedNames] = useState<Set<string>>(new Set());

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
          onDone={(changed) => {
            setAdding(false);
            if (changed) refresh();
          }}
        />
      )}
      {editing && (
        <ChildModal
          child={editing}
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
                    <Flag bg={c.photoConsent ? "rgba(21,179,100,.14)" : "rgba(120,126,142,.14)"} fg={c.photoConsent ? "#0f7a44" : "var(--ink-3)"}>
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
