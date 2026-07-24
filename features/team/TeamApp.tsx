"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, Input, SectionHead } from "@/components/ui";

interface Invite {
  token: string;
  role: "franchise" | "staff";
  createdAt: string;
  usedBy: string | null;
  sentTo?: string | null;
}

interface Me {
  role: string;
  tenantName: string | null;
}

/**
 * Minimal team management: create and track invites (franchises and staff
 * join a tenant through these). With an email typed, the invite is emailed
 * directly; either way the link can be copied and shared by hand.
 * Registered as the "Staff" view for company and franchise portals.
 */
export function TeamApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sentNote, setSentNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Invite[]>("/api/invites").then(setInvites).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load invites"),
    );
  }, []);

  useEffect(() => {
    apiGet<Me>("/api/me").then(setMe).catch(() => {});
    refresh();
  }, [refresh]);
  useRealtime(["invites"], refresh);

  async function createInvite(role: "franchise" | "staff") {
    setBusy(true);
    setError(null);
    setSentNote(null);
    try {
      const to = email.trim();
      const r = await apiPost<{ token: string; sentTo: string | null }>("/api/invites", {
        role,
        ...(to ? { email: to } : {}),
      });
      if (r.sentTo) {
        setSentNote(`Invite emailed to ${r.sentTo}`);
        setEmail("");
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invite");
    }
    setBusy(false);
  }

  function copy(token: string) {
    const url = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const canInviteFranchise = me?.role === "company";

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Team &amp; invites
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        {me?.tenantName ? `${me.tenantName} — ` : ""}type an email to send the invite directly, or
        create it blank and share the link yourself.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com (optional)"
          className="w-[240px]"
        />
        {canInviteFranchise && (
          <Button variant="primary" disabled={busy} onClick={() => createInvite("franchise")}>
            + Invite a franchise
          </Button>
        )}
        <Button variant={canInviteFranchise ? "default" : "primary"} disabled={busy} onClick={() => createInvite("staff")}>
          + Invite staff
        </Button>
        {sentNote && <span className="text-[12px] font-bold text-[#3f78d8]">{sentNote}</span>}
      </div>

      <SectionHead>Invite links</SectionHead>
      {!invites ? (
        <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : invites.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">
          No invites yet — create one above and share the link.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map((inv) => (
            <Card key={inv.token} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    inv.role === "franchise"
                      ? { bg: "var(--brand-soft)", fg: "var(--brand-strong)" }
                      : { bg: "#e8f3fc", fg: "#1d6fb8" }
                  }
                >
                  {inv.role}
                </Badge>
                <span className="font-mono text-[11.5px] text-[var(--ink-3)]">
                  …{inv.token.slice(-8)}
                </span>
                <span className="text-[11.5px] text-[var(--ink-3)]">{inv.createdAt.slice(0, 10)}</span>
                {inv.sentTo && <span className="text-[11.5px] text-[var(--ink-3)]">→ {inv.sentTo}</span>}
              </div>
              <div className="flex items-center gap-2">
                {inv.usedBy ? (
                  <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>Used</Badge>
                ) : (
                  <>
                    <Badge tone={{ bg: "#FCE9CE", fg: "#B45309" }}>Pending</Badge>
                    <Button sm onClick={() => copy(inv.token)}>
                      {copied === inv.token ? "Copied!" : "Copy link"}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
