"use client";

import { useT } from "@/lib/i18n/provider";
import { addonsByChild, ADDON_ICON, type BookingAddonSource } from "./addons";
import { money } from "./helpers";

/** The extras on a booking, PER CHILD: "sally james — T-shirt · size: M · £10.00". Replaces the old single grey line, so a two-child booking with
 *  different sizes reads as who gets what. Meals (🍽) sit in the same list. Used on the provider's booking page and the family's own booking. */
export function AddonBlock({ booking, prices = true, meals = true }: { booking: BookingAddonSource; prices?: boolean; meals?: boolean }) {
  const t = useT();
  const groups = addonsByChild(booking).map((g) => ({ ...g, lines: g.lines.filter((l) => meals || !l.meal) })).filter((g) => g.lines.length);
  if (!groups.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)]" data-testid="addon-block">
      <div className="border-b border-[var(--line)] px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{ADDON_ICON} {t("p8lst.extrasTitle")}</div>
      {groups.map((g) => (
        <div key={g.child || "_"} className="border-b border-[var(--line)] px-3.5 py-2.5 last:border-0">
          {g.child && <div className="mb-1 text-[13px] font-extrabold">{g.child}</div>}
          <table className="w-full text-[13px]"><tbody>
            {g.lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="py-0.5 pe-3 font-semibold">{l.meal ? "🍽 " : ""}{l.name}</td>
                <td className="py-0.5 pe-3 text-[var(--ink-2)]">{l.choice}</td>
                <td className="py-0.5 pe-3 text-[var(--ink-3)]">{l.perDay || l.meal ? (l.days.length ? l.days.map((d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })).join(", ") : "") : (l.qty > 1 ? `× ${l.qty}` : "")}</td>
                {prices && <td className="py-0.5 text-end font-bold">{money(l.price)}</td>}
              </tr>
            ))}
          </tbody></table>
        </div>
      ))}
    </div>
  );
}
