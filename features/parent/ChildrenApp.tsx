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
  school?: string;
  allergies?: string;
  medical?: string;
  send?: string;
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

function Avatar({ child, size = 44 }: { child: Pick<Child, "name" | "photo">; size?: number }) {
  if (child.photo) {
    return (
      // Inline data-URL avatar — next/image adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={child.photo}
        alt={child.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-[var(--brand-soft)] font-extrabold text-[var(--brand-strong)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {child.name ? child.name[0].toUpperCase() : "?"}
    </div>
  );
}

function AddChildModal({ onDone }: { onDone: (changed: boolean) => void }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"boy" | "girl" | "">("");
  const [school, setSchool] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medical, setMedical] = useState("");
  const [send, setSend] = useState("");
  const [collectionPassword, setCollectionPassword] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiPost("/api/my/children", {
        name: name.trim(),
        dob: dob.trim(),
        sex,
        ...(school.trim() ? { school: school.trim() } : {}),
        ...(allergies.trim() ? { allergies: allergies.trim() } : {}),
        ...(medical.trim() ? { medical: medical.trim() } : {}),
        ...(send.trim() ? { send: send.trim() } : {}),
        ...(collectionPassword.trim() ? { collectionPassword: collectionPassword.trim() } : {}),
        photoConsent,
        ...(photo ? { photo } : {}),
      });
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onDone(false)}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
    >
      <div className="w-full max-w-[460px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            Add a child
          </h3>
          <button
            type="button"
            onClick={() => onDone(false)}
            className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={save} className="flex flex-col gap-3.5 px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-[56px] w-[56px] flex-none items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--panel)] text-[22px] text-[var(--ink-2)]"
              aria-label="Upload photo"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                "+"
              )}
            </button>
            {/* The upload was here with nothing saying what it was for. A
                parent uploads a photo of their child when they know why. */}
            <div className="min-w-0 flex-1">
              <Button type="button" onClick={() => fileRef.current?.click()}>
                {photo ? "Change photo" : "Add a photo"}
              </Button>
              <div className="mt-1 text-[11px] leading-[1.45] text-[var(--ink-3)]">
                Optional. It goes on the register so staff who haven&rsquo;t met them know who
                they&rsquo;re greeting, and who they&rsquo;re handing over to at the end of the day.
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
          </div>

          <div>
            <FieldLabel>Full name</FieldLabel>
            <Input
              required
              placeholder="Child’s name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <FieldLabel>Date of birth</FieldLabel>
            <Input
              required
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <FieldLabel>Boy or girl</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {([["boy", "Boy"], ["girl", "Girl"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setSex(v)}
                  className="rounded-xl border p-2.5 text-[12.5px] font-extrabold"
                  style={sex === v
                    ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" }
                    : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>School</FieldLabel>
            <Input
              placeholder="School name"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <FieldLabel>Allergies</FieldLabel>
            <Input
              placeholder="e.g. nuts"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <FieldLabel>Medical (e.g. asthma)</FieldLabel>
            <Input value={medical} onChange={(e) => setMedical(e.target.value)} className="w-full" />
          </div>
          <div>
            <FieldLabel>SEND / accessibility</FieldLabel>
            <Input
              placeholder="Describe needs"
              value={send}
              onChange={(e) => setSend(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Safeguarding. Says what it is for, because a field called
              "password" with no explanation gets left blank. */}
          <div>
            <FieldLabel>Collection password</FieldLabel>
            <div className="mb-1 text-[11px] leading-[1.45] text-[var(--ink-3)]">
              Pick a word only your family knows. If <b className="text-[var(--ink-2)]">anyone other than you</b>{" "}
              comes to collect them — a grandparent, a friend, another parent on the school run — staff will ask
              for it, and won&rsquo;t hand over without it. Staff can see this word, so don&rsquo;t reuse a
              password from anywhere else.
            </div>
            <Input
              placeholder="e.g. Bluebell"
              value={collectionPassword}
              onChange={(e) => setCollectionPassword(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <FieldLabel>Photo permission</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: true, label: "Photos allowed", desc: "May appear in Moments & newsfeed" },
                { v: false, label: "No photos", desc: "Never photographed or shared" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  type="button"
                  onClick={() => setPhotoConsent(opt.v)}
                  className="rounded-xl border p-2.5 text-left"
                  style={
                    photoConsent === opt.v
                      ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" }
                      : { borderColor: "var(--line)", background: "var(--surface)" }
                  }
                >
                  <div
                    className="text-[12.5px] font-extrabold"
                    style={{ color: photoConsent === opt.v ? "var(--brand-ink)" : "var(--ink)" }}
                  >
                    {opt.v ? "📷 " : "🚫 "}
                    {opt.label}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: photoConsent === opt.v ? "var(--brand-strong)" : "var(--ink-3)" }}
                  >
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
          {!sex && <div className="text-[12px] text-[var(--ink-3)]">Still needed: boy or girl.</div>}
          <Button variant="primary" type="submit" disabled={busy || !sex} className="w-full justify-center">
            {busy ? "Saving…" : "Save"}
          </Button>
        </form>
      </div>
    </div>
  );
}

/** custdash/children — the family's child profiles (used at booking time). */
export function ChildrenApp() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Child[]>("/api/my/children")
      .then(setChildren)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load children"));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["children"], refresh);

  async function remove(c: Child) {
    if (!confirm(`Remove ${c.name}? Existing bookings are unaffected.`)) return;
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            My children
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Saved profiles — pick them in one tap when you book.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          + Add a child
        </Button>
      </div>

      {error && <div className="mb-3 text-[12.5px] text-[var(--red)]">{error}</div>}

      {adding && (
        <AddChildModal
          onDone={(changed) => {
            setAdding(false);
            if (changed) refresh();
          }}
        />
      )}

      {children.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          No children saved yet — add them once and booking gets faster.
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {children.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar child={c} />
                  <div>
                    <div className="text-[15px] font-extrabold">{c.name}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                      {[
                        c.age !== undefined ? `age ${c.age}` : null,
                        c.dob,
                        c.school,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                <Button sm variant="danger" onClick={() => remove(c)}>
                  Remove
                </Button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${
                    c.photoConsent
                      ? "bg-[var(--green-soft,#e7f8ee)] text-[#0f7a44]"
                      : "bg-[#eef0f6] text-[#5b6478]"
                  }`}
                >
                  {c.photoConsent ? "📷 Photos allowed" : "🚫 No photos"}
                </span>
                {c.allergies && (
                  <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--red,#e21d27)]">
                    ⚠ {c.allergies}
                  </span>
                )}
                {c.medical && (
                  <span className="rounded-full bg-[#e8f3fc] px-2.5 py-[3px] text-[11px] font-bold text-[#1d6fb8]">
                    ⚕ {c.medical}
                  </span>
                )}
                {c.send && (
                  <span className="rounded-full bg-[var(--violet-soft,#efe9ff)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--violet,#6a4fd0)]">
                    ♿ {c.send}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
