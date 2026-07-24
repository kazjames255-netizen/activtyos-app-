"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";

interface Tenant {
  id: string;
  name: string;
  type: "company" | "freelancer";
  createdAt: string;
}

/** platform/providers — every tenant on the platform (super-admin view). */
export function ProvidersApp() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Tenant[]>("/api/tenants")
      .then(setTenants)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load providers"));
  }, []);

  useEffect(load, [load]);
  useRealtime(["tenants"], load);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!tenants)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading providers…</div>;

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Providers
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Every tenant on the platform — {tenants.length} provider{tenants.length === 1 ? "" : "s"}.
      </p>
      <div className="flex flex-col gap-2">
        {tenants.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
            <div>
              <div className="text-[14px] font-extrabold">{t.name}</div>
              <div className="text-[11.5px] text-[var(--ink-3)]">
                {t.id} · since {t.createdAt?.slice(0, 10) ?? "—"}
              </div>
            </div>
            <Badge
              tone={
                t.type === "company"
                  ? { bg: "var(--brand-soft)", fg: "var(--brand-strong)" }
                  : { bg: "#eaf0fc", fg: "#1d3a8f" }
              }
            >
              {t.type}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
