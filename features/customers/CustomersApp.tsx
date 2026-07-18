"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Customers & families — the tenant's parent records. SELF-FILLING: every
// booking (taken or self-served) upserts the family server-side, so this
// page grows on its own; the form below covers the manual cases (a family
// phoning before their first booking, fixing a record). Staff see it
// read-only. Deliberately simple — a richer version is a UI milestone.
// ─────────────────────────────────────────────────────────────────────────

interface Child {
  name: string;
  age?: number;
  dob?: string;
}
interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  children?: Child[];
}
interface Draft {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  children: { name: string; age: string }[];
}

const emptyDraft = (): Draft => ({ id: null, name: "", email: "", phone: "", children: [] });

export function CustomersApp() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Customer[]>("/api/customers")
      .then((c) => {
        setCustomers(c);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
  }, []);
  useEffect(() => {
    refresh();
    apiGet<{ role: string }>("/api/me")
      .then((me) => setCanWrite(["company", "freelancer", "franchise"].includes(me.role)))
      .catch(() => {});
  }, [refresh]);
  useRealtime(["customers"], refresh);

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      children: draft.children
        .filter((k) => k.name.trim())
        .map((k) => ({ name: k.name.trim(), ...(k.age !== "" ? { age: parseInt(k.age, 10) || 0 } : {}) })),
    };
    try {
      if (draft.id) await api(`/api/customers/${encodeURIComponent(draft.id)}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiPost("/api/customers", body);
      setDraft(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setBusy(false);
  }

  async function remove(c: Customer) {
    if (!confirm(`Remove “${c.name}” and their family record? Their bookings are kept.`)) return;
    try {
      await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const edit = (c: Customer) =>
    setDraft({
      id: c.id,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      children: (c.children ?? []).map((k) => ({ name: k.name, age: k.age !== undefined ? String(k.age) : "" })),
    });

  const query = q.trim().toLowerCase();
  const shown = (customers ?? []).filter(
    (c) =>
      !query ||
      `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${(c.children ?? []).map((k) => k.name).join(" ")}`
        .toLowerCase()
        .includes(query),
  );

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          Customers &amp; families
        </h2>
        {canWrite && !draft && (
          <Button variant="primary" onClick={() => setDraft(emptyDraft())}>
            ＋ Add family
          </Button>
        )}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Every booking adds or updates the family automatically — this list grows by itself.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      {draft && (
        <Card className="mb-3.5 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">{draft.id ? "Edit family" : "Add a family"}</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <FieldLabel>Parent name</FieldLabel>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="w-full" />
            </div>
          </div>
          <div className="mt-2.5">
            <FieldLabel>Children</FieldLabel>
            {draft.children.map((k, i) => (
              <div key={i} className="mb-1.5 flex gap-1.5">
                <Input
                  placeholder="Name"
                  value={k.name}
                  onChange={(e) => setDraft({ ...draft, children: draft.children.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  className="w-full"
                />
                <Input
                  placeholder="Age"
                  type="number"
                  value={k.age}
                  onChange={(e) => setDraft({ ...draft, children: draft.children.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)) })}
                  className="w-[90px]"
                />
                <button
                  type="button"
                  className="px-1 text-[var(--ink-3)]"
                  onClick={() => setDraft({ ...draft, children: draft.children.filter((_, j) => j !== i) })}
                  aria-label="Remove child"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-[12px] font-bold text-[var(--brand-2,#2f6bd8)] underline"
              onClick={() => setDraft({ ...draft, children: [...draft.children, { name: "", age: "" }] })}
            >
              + Add child
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={busy || !draft.name.trim()} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Search by parent, child, email or phone…" className="mb-3 w-full max-w-[360px]" />

      {!customers ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading families…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {query ? "No families match your search." : "No families yet — they appear here automatically with their first booking."}
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-extrabold">{c.name}</div>
                  <div className="truncate text-[12px] text-[var(--ink-3)]">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex flex-none gap-1.5">
                    <Button sm onClick={() => edit(c)}>
                      Edit
                    </Button>
                    <Button sm variant="danger" onClick={() => remove(c)}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(c.children ?? []).length === 0 ? (
                  <span className="text-[11.5px] text-[var(--ink-3)]">No children on record</span>
                ) : (
                  (c.children ?? []).map((k) => (
                    <span key={k.name} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]">
                      {k.name}
                      {k.age !== undefined ? ` · ${k.age}` : ""}
                    </span>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
