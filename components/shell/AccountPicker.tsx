"use client";

// HQ super-admin: open ANY provider or parent account and see the app exactly as
// they do (impersonation). Platform-only; each open is audit-logged server-side.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost, setActAs } from "@/lib/api";
import { getDefaultView, type PortalKey } from "@/lib/nav/config";
import { useT } from "@/lib/i18n/provider";

interface Account { uid: string; email: string; name: string; role: string; label: string; provider: string; portal: string }
const ROLE_CHIP: Record<string, { key: string; bg: string; fg: string }> = {
  company: { key: "p8ops.shRoleCompany", bg: "#E8EEFD", fg: "#2f5fd0" },
  franchise: { key: "p8ops.shRoleFranchise", bg: "#E8EEFD", fg: "#2f5fd0" },
  freelancer: { key: "p8ops.shRoleFreelancer", bg: "#E8EEFD", fg: "#2f5fd0" },
  staff: { key: "p8ops.shRoleStaff", bg: "#E2F6EC", fg: "#0f7a43" },
  parent: { key: "p8ops.shRoleParent", bg: "#FCF1DC", fg: "#F5A524" },
};

export function AccountPicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ accounts: Account[] }>("/api/platform/accounts").then((d) => setAccounts(d.accounts ?? [])).catch((e) => { setErr(e instanceof Error ? e.message : t("p8ops.shCouldntLoadAccounts")); setAccounts([]); });
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (accounts ?? []).filter((a) => !ql || a.label.toLowerCase().includes(ql) || a.email.toLowerCase().includes(ql) || a.provider.toLowerCase().includes(ql) || a.role.includes(ql));
  }, [accounts, q]);

  async function open(a: Account) {
    setBusy(a.uid); setErr(null);
    try {
      const r = await apiPost<{ uid: string; role: string; portal: string }>("/api/platform/impersonate", { uid: a.uid });
      setActAs({ uid: a.uid, label: a.label, portal: r.portal, role: r.role });
      onClose();
      router.push(`/${r.portal}/${getDefaultView(r.portal as PortalKey)}`);
    } catch (e) { setErr(e instanceof Error ? e.message : t("p8ops.shCouldntOpenAccount")); setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/45 p-4 pt-[8vh]" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[0_24px_60px_-16px_rgba(15,23,42,.5)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("p8ops.shOpenAccount")}</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{t("p8ops.shOpenAccountSub")}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">✕</button>
        </div>
        <div className="border-b border-[var(--line)] p-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8ops.shSearchAccounts")} className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] outline-none focus:border-[#2f6bd8]" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {err && <div className="m-2 rounded-lg border border-[#E4E9F5] bg-[#FDE7EF] px-3 py-2 text-[12px] text-[#C81E5E]">{err}</div>}
          {!accounts ? <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8ops.shLoadingAccounts")}</div>
            : filtered.length === 0 ? <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8ops.shNoAccountsMatch", { q })}</div>
            : filtered.map((a) => {
                const chip = ROLE_CHIP[a.role] ?? ROLE_CHIP.parent;
                return (
                  <button key={a.uid} type="button" disabled={busy === a.uid} onClick={() => open(a)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-[var(--panel)] disabled:opacity-50">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#2f5fd0,#2f5fd0)" }}>{(a.label.trim()[0] ?? "?").toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{a.label}</div>
                      <div className="truncate text-[11.5px] text-[var(--ink-3)]">{a.email}{a.provider && a.role !== "parent" ? "" : a.provider ? ` · ${a.provider}` : ""}</div>
                    </div>
                    <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: chip.bg, color: chip.fg }}>{t(chip.key)}</span>
                    <span className="flex-none text-[12px] font-bold text-[#2f5fd0]">{busy === a.uid ? t("p8ops.shOpening") : t("p8ops.shOpenArrow")}</span>
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
}
