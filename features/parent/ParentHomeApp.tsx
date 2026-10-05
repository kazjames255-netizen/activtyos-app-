"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT } from "@/lib/i18n/provider";
import { dateLocale } from "@/lib/i18n/format";
import { useCustomerArea } from "@/lib/use-customer-area";
import { useCouponCount, useUnreadMessages } from "@/lib/use-unread";
import { money } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";

// ─────────────────────────────────────────────────────────────────────────
// custdash/home — the parent's landing page.
//
// Read-only summary built from existing endpoints (nothing new server-side):
//   /api/my/bookings, /api/my/children, /api/my/providers, /api/account,
//   /api/my/wallet, /api/my/trips, /api/posts, + the shared unread/coupon hooks.
// Phone: one column, big tappable tiles. >=1024px: two-column dashboard.
// Every block reserves its space while loading so nothing jumps.
// ─────────────────────────────────────────────────────────────────────────

type Kid = { id: string; name: string; photo?: string };
type WalletBalance = { balance: number };
type TripRow = { id: string; date: string; status: string; askConsent: boolean; children: { consent: string }[] };
type PostRow = { id: string; title?: string; body: string; tenantName?: string; createdAt?: string; pinned?: boolean };
type ListingBrief = {
  location?: string | null;
  library?: { venue?: { name?: string } | null } | null;
  bundle?: { periods?: { title: string; start?: string; finish?: string }[] } | null;
};

const NO_PLACE_YET = ["Waitlisted", "Offered", "Approval needed"];
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function bookingDays(b: Booking): string[] {
  const own = b.days ?? [];
  if (own.length) return own;
  return (b.kids ?? []).flatMap((k) => k.dates ?? k.days ?? []);
}
function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";
const initial = (n: string) => (n.trim()[0] ?? "?").toUpperCase();
const HUES = ["#2f6bd8", "#7a5af8", "#0ea5a5", "#e22295", "#f59e0b", "#15b364"];

function Avatar({ kid, size = 44 }: { kid: Kid; size?: number }) {
  if (kid.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={kid.photo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const hue = HUES[(kid.name.charCodeAt(0) || 0) % HUES.length];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: hue }} aria-hidden>
      {initial(kid.name)}
    </span>
  );
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--line)] ${className}`} aria-hidden />;
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="m-0 text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{children}</h2>
      {action}
    </div>
  );
}

const cardCls = "rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]";

export function ParentHomeApp() {
  const t = useT();
  const h = (k: string, v?: Record<string, string | number>) => t(`p7shell.home${k}`, v);
  const area = useCustomerArea("custdash");
  const unread = useUnreadMessages("custdash");
  const coupons = useCouponCount("custdash");

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [wallet, setWallet] = useState<number | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [post, setPost] = useState<PostRow | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useRef<Set<string>>(new Set());

  const loadCore = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings").then((r) => { setBookings(r ?? []); setFailed(false); }).catch(() => { setBookings((b) => b ?? []); setFailed(true); });
    apiGet<Kid[]>("/api/my/children").then((r) => setKids(r ?? [])).catch(() => setKids((k) => k ?? []));
  }, []);
  useEffect(() => { loadCore(); }, [loadCore]);
  useRealtime(["bookings", "children"], loadCore);

  useEffect(() => {
    // A brand-new parent has no booking yet, so /api/my/providers can be empty: fall back to the provider on the account itself.
    Promise.all([
      apiGet<{ name: string }[]>("/api/my/providers").catch(() => [] as { name: string }[]),
      apiGet<{ tenantName?: string | null }>("/api/me").catch(() => null),
    ]).then(([ps, me]) => setProvider(ps?.[0]?.name ?? me?.tenantName ?? ""));
    apiGet<{ name?: string }>("/api/account").then((r) => setName(firstName(r?.name ?? ""))).catch(() => {});
  }, []);

  const loadWallet = useCallback(() => {
    if (area.wallet === false) { setWallet(null); return; }
    apiGet<{ balances: WalletBalance[] }>("/api/my/wallet").then((r) => setWallet((r?.balances ?? []).reduce((s, b) => s + (b.balance ?? 0), 0))).catch(() => setWallet(null));
  }, [area.wallet]);
  useEffect(() => { loadWallet(); }, [loadWallet]);
  useRealtime(["wallet"], loadWallet);

  const loadTrips = useCallback(() => {
    if (area.trips === false) { setTrips([]); return; }
    apiGet<TripRow[]>("/api/my/trips").then((r) => setTrips(r ?? [])).catch(() => setTrips([]));
  }, [area.trips]);
  useEffect(() => { loadTrips(); }, [loadTrips]);
  useRealtime(["notifications"], loadTrips);

  useEffect(() => {
    if (area.newsfeed === false) return;
    apiGet<PostRow[]>("/api/posts")
      .then((r) => setPost((r ?? []).slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || `${b.createdAt ?? ""}`.localeCompare(`${a.createdAt ?? ""}`))[0] ?? null))
      .catch(() => setPost(null));
  }, [area.newsfeed]);

  const today = isoToday();
  const live = useMemo(() => (bookings ?? []).filter((b) => b.status !== "Cancelled" && b.status !== "Declined"), [bookings]);

  const toPay = useMemo(
    () => live.filter((b) => !NO_PLACE_YET.includes(b.status) && b.pay !== "Paid" && b.pay !== "Refunded" && (b.amount ?? 0) > 0),
    [live],
  );
  const owed = toPay.reduce((s, b) => s + Math.max(0, (b.amount ?? 0) - (b.pay === "Unpaid" ? 0 : (b.amountPaid ?? 0))), 0);
  const consentWaiting = trips.filter((tr) => tr.askConsent && tr.status === "planned" && tr.date >= today).reduce((s, tr) => s + tr.children.filter((c) => c.consent === "pending").length, 0);
  const requests = live.filter((b) => b.dateChangeRequest?.status === "pending" || b.cancel?.refund === "pending").length;
  const offers = live.filter((b) => b.status === "Offered").length;

  // Next up: confirmed places with a session still ahead, soonest first.
  const upcoming = useMemo(() => {
    return live
      .filter((b) => b.status === "Confirmed")
      .map((b) => ({ b, next: bookingDays(b).filter((d) => d >= today).sort()[0] ?? null, hasDays: bookingDays(b).length > 0 }))
      .filter((x) => (x.hasDays ? !!x.next : !x.b.past))
      .sort((a, c) => (a.next ?? "9999").localeCompare(c.next ?? "9999"))
      .slice(0, 3);
  }, [live, today]);

  // Venue + time for the few cards shown (one read per listing, once).
  const [briefs, setBriefs] = useState<Record<string, ListingBrief | null>>({});
  const upIds = upcoming.map((u) => u.b.listingId).filter(Boolean).join(",");
  useEffect(() => {
    for (const id of upIds.split(",").filter(Boolean)) {
      if (asked.current.has(id)) continue;
      asked.current.add(id);
      apiGet<ListingBrief>(`/api/listings/${encodeURIComponent(id)}`)
        .then((l) => setBriefs((m) => ({ ...m, [id]: l ?? null })))
        .catch(() => setBriefs((m) => ({ ...m, [id]: null })));
    }
  }, [upIds]);
  const timeFor = (b: Booking): string | null => {
    const ps = (b.listingId ? briefs[b.listingId]?.bundle?.periods : undefined) ?? [];
    const p = ps.find((x) => x.title === b.timing) ?? (ps.length === 1 ? ps[0] : undefined);
    return p?.start && p?.finish ? `${p.start}–${p.finish}` : null;
  };

  const loading = bookings === null || kids === null;
  const noKids = !loading && kids.length === 0;
  const noBookings = !loading && live.length === 0;
  const attention = toPay.length > 0 || consentWaiting > 0 || unread > 0 || requests > 0 || offers > 0;
  const browseOn = area.browse !== false;

  const tiles: { href: string; icon: string; label: string; sub?: string; show: boolean; badge?: number }[] = [
    { href: "/custdash/browse", icon: "🔎", label: h("TileBook"), show: browseOn },
    { href: "/custdash/messages", icon: "✉️", label: t("header.messages"), sub: unread ? h("Unread", { n: unread }) : undefined, badge: unread, show: area.messaging !== false && !area.simpleMode },
    { href: "/custdash/wallet", icon: "👛", label: t("p7shell.tabWallet"), sub: wallet !== null ? money(wallet) : undefined, show: area.wallet !== false && !area.simpleMode },
    { href: "/custdash/coupons", icon: "🏷️", label: h("TileCoupons"), sub: coupons ? h("CouponsN", { n: coupons }) : undefined, show: area.coupons !== false && !area.simpleMode },
    { href: "/custdash/moments", icon: "📷", label: h("TileMoments"), show: area.moments !== false && !area.simpleMode },
    { href: "/custdash/newsfeed", icon: "📢", label: t("p7shell.newsfeed"), show: area.newsfeed !== false && !area.simpleMode },
  ];

  const attn = (href: string, tone: string, icon: string, title: string, sub: string, cta?: string) => (
    <Link key={href + title} href={href} className="flex min-h-[64px] items-center gap-3 rounded-2xl border p-3 no-underline" style={{ borderColor: tone, background: "var(--surface)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)` }} aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold text-[var(--ink)]">{title}</span>
        <span className="block text-[14px] text-[var(--ink-2)]">{sub}</span>
      </span>
      {cta && <span className="shrink-0 rounded-full px-4 py-2.5 text-[14px] font-extrabold text-white" style={{ background: tone }}>{cta}</span>}
      {!cta && <span className="shrink-0 text-[20px] text-[var(--ink-3)]" aria-hidden>›</span>}
    </Link>
  );

  const payHref = toPay.length === 1 ? `/custdash/bookings?pay=${encodeURIComponent(toPay[0].ref)}` : "/custdash/bookings?tab=payments";

  // ── blocks (rendered in different columns on desktop) ──────────────────
  const greeting = (
    <div>
      <h1 className="m-0 text-[26px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>
        {name ? h("Hello", { name }) : h("HelloNoName")}
      </h1>
      <p className="m-0 mt-1 min-h-[21px] text-[15px] text-[var(--ink-2)]">
        {provider ? h("With", { provider }) : " "}
      </p>
    </div>
  );

  const attentionBlock = loading ? (
    <div><Sk className="mb-2 h-5 w-44" /><Sk className="h-[66px] w-full" /></div>
  ) : attention ? (
    <section aria-label={h("Attention")}>
      <SectionTitle>{h("Attention")}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {toPay.length > 0 && (
          <div key="topay" className="flex flex-col gap-1.5">
            {attn(payHref, "var(--brand, #2f6bd8)", "💳", h("ToPay", { n: toPay.length }), h("ToPaySub", { amt: money(owed) }), h("Pay"))}
            {/* Changed your mind? The booking page has "Cancel booking" - one tap away from here. */}
            <Link href={toPay.length === 1 ? `/custdash/bookings?open=${encodeURIComponent(toPay[0].ref)}` : "/custdash/bookings"} className="self-end px-2 text-[13.5px] font-bold text-[var(--ink-2)] underline">{h("CancelUnpaid", { n: toPay.length })}</Link>
          </div>
        )}
        {offers > 0 && attn("/custdash/bookings", "#15b364", "🎟️", h("Offers", { n: offers }), h("OffersSub"))}
        {consentWaiting > 0 && attn("/custdash/trips", "#f59e0b", "🚌", h("Consent", { n: consentWaiting }), h("ConsentSub"))}
        {unread > 0 && attn("/custdash/messages", "#7a5af8", "✉️", h("Unread", { n: unread }), h("UnreadSub"))}
        {requests > 0 && attn("/custdash/bookings", "#0ea5a5", "🕑", h("Requests", { n: requests }), h("RequestsSub"))}
      </div>
    </section>
  ) : null;

  const nextBlock = (
    <section aria-label={h("NextUp")}>
      <SectionTitle action={!loading && live.length > 0 ? <Link href="/custdash/bookings" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-[var(--brand)] no-underline">{h("SeeAll")}</Link> : undefined}>{h("NextUp")}</SectionTitle>
      {loading ? (
        <Sk className="h-[112px] w-full" />
      ) : upcoming.length === 0 ? (
        <div className={`${cardCls} p-4`}>
          <p className="m-0 text-[15px] font-bold text-[var(--ink)]">{noBookings ? h("NoBookings") : h("NothingNext")}</p>
          {browseOn && <Link href="/custdash/browse" className="mt-3 inline-flex min-h-[48px] items-center rounded-full px-5 text-[15px] font-extrabold text-white no-underline" style={{ background: "var(--brand, #2f6bd8)" }}>{h("BrowseCta")}</Link>}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {upcoming.map(({ b, next }, i) => {
            const br = b.listingId ? briefs[b.listingId] : null;
            const place = br?.library?.venue?.name ?? br?.location ?? null;
            const time = timeFor(b);
            return (
              <div key={b.ref} className={`${cardCls} items-center gap-3 p-3.5 ${i >= 2 ? "hidden lg:flex" : "flex"}`}>
                <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-tight" style={{ background: "var(--brand-soft, #eaf0fc)", color: "var(--brand, #2f6bd8)" }}>
                  {next ? (
                    <>
                      <span className="text-[12px] font-extrabold uppercase">{new Date(`${next}T00:00:00Z`).toLocaleDateString(dateLocale(), { month: "short", timeZone: "UTC" })}</span>
                      <span className="text-[20px] font-extrabold">{new Date(`${next}T00:00:00Z`).getUTCDate()}</span>
                    </>
                  ) : <span className="text-[20px]" aria-hidden>🎟️</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-extrabold leading-tight text-[var(--ink)]">{b.listing}</span>
                  <span className="block break-words text-[14px] text-[var(--ink-2)]">{[b.child, next ? fmtDay(next) : b.dates, time].filter(Boolean).join(" · ")}</span>
                  {place && <span className="block truncate text-[14px] text-[var(--ink-3)]">📍 {place}</span>}
                </span>
                <Link href={`/custdash/bookings?open=${encodeURIComponent(b.ref)}`} className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-[var(--line)] px-4 text-[14px] font-bold text-[var(--ink)] no-underline">{h("Details")}</Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const childrenBlock = (
    <section aria-label={h("Children")}>
      <SectionTitle action={!loading && !noKids ? <Link href="/custdash/children" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-[var(--brand)] no-underline">{h("Manage")}</Link> : undefined}>{h("Children")}</SectionTitle>
      {loading ? (
        <div className="flex gap-2.5"><Sk className="h-[56px] w-36" /><Sk className="h-[56px] w-36" /></div>
      ) : noKids ? (
        <Link href="/custdash/children" className={`${cardCls} flex min-h-[72px] items-center gap-3 p-3.5 no-underline`} style={{ borderStyle: "dashed", borderColor: "var(--brand, #2f6bd8)" }}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] font-extrabold text-white" style={{ background: "var(--brand, #2f6bd8)" }} aria-hidden>+</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-[var(--ink)]">{h("AddChild")}</span>
            <span className="block text-[14px] text-[var(--ink-2)]">{h("AddChildSub")}</span>
          </span>
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {kids.map((k) => (
            <Link key={k.id} href="/custdash/children" className="flex min-h-[56px] max-w-full items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 ps-1.5 pe-4 no-underline">
              <Avatar kid={k} size={44} />
              <span className="truncate text-[15px] font-bold text-[var(--ink)]">{firstName(k.name)}</span>
            </Link>
          ))}
          <Link href="/custdash/children" className="flex min-h-[56px] items-center gap-2 rounded-full border border-dashed border-[var(--line)] px-4 text-[14px] font-bold text-[var(--brand)] no-underline">+ {h("AddChildShort")}</Link>
        </div>
      )}
    </section>
  );

  const tilesBlock = (
    <section aria-label={h("Quick")}>
      <SectionTitle>{h("Quick")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.filter((x) => x.show).map((x) => (
          <Link key={x.href} href={x.href} className={`${cardCls} relative flex min-h-[72px] items-center gap-3 p-3 no-underline`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px]" style={{ background: "var(--brand-soft, #eaf0fc)" }} aria-hidden>{x.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] font-extrabold leading-tight text-[var(--ink)]">{x.label}</span>
              <span className="block min-h-[18px] truncate text-[14px] text-[var(--ink-2)]">{x.sub ?? " "}</span>
            </span>
            {!!x.badge && <span className="absolute end-2 top-2 flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[12px] font-extrabold text-white" style={{ background: "var(--sem-crit, #ef4444)" }}>{x.badge}</span>}
          </Link>
        ))}
      </div>
    </section>
  );

  const walletBlock = (wallet !== null && area.wallet !== false && !area.simpleMode) || (coupons > 0 && area.coupons !== false && !area.simpleMode) ? (
    <section aria-label={h("Savings")} className="hidden lg:block">
      <SectionTitle>{h("Savings")}</SectionTitle>
      <div className={`${cardCls} grid grid-cols-2 divide-x divide-[var(--line)] rtl:divide-x-reverse`}>
        <Link href="/custdash/wallet" className="block p-4 no-underline">
          <span className="block text-[14px] text-[var(--ink-2)]">{t("p7shell.tabWallet")}</span>
          <span className="block text-[24px] font-extrabold text-[var(--ink)]">{money(wallet ?? 0)}</span>
        </Link>
        <Link href="/custdash/coupons" className="block p-4 no-underline">
          <span className="block text-[14px] text-[var(--ink-2)]">{h("TileCoupons")}</span>
          <span className="block text-[24px] font-extrabold text-[var(--ink)]">{coupons}</span>
        </Link>
      </div>
    </section>
  ) : null;

  const newsBlock = post && area.newsfeed !== false && !area.simpleMode ? (
    <section aria-label={t("p7shell.newsfeed")} className="hidden lg:block">
      <SectionTitle action={<Link href="/custdash/newsfeed" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-[var(--brand)] no-underline">{h("SeeAll")}</Link>}>{t("p7shell.newsfeed")}</SectionTitle>
      <Link href="/custdash/newsfeed" className={`${cardCls} block p-4 no-underline`}>
        <span className="block text-[15px] font-extrabold text-[var(--ink)]">{post.title || post.tenantName || t("p7shell.newsfeed")}</span>
        <span className="mt-1 block text-[14px] text-[var(--ink-2)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">{post.body}</span>
      </Link>
    </section>
  ) : null;

  // New parent: a two-step nudge (add child -> browse) above everything else.
  const starter = !loading && noKids && noBookings ? (
    <section className={`${cardCls} p-4`} aria-label={h("Start")}>
      <p className="m-0 text-[16px] font-extrabold text-[var(--ink)]">{h("Start")}</p>
      <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        <li>
          <Link href="/custdash/children" className="flex min-h-[56px] items-center gap-3 rounded-xl p-2 text-[15px] font-bold text-[var(--ink)] no-underline" style={{ background: "var(--brand-soft, #eaf0fc)" }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: "var(--brand, #2f6bd8)" }}>1</span>{h("Step1")}
          </Link>
        </li>
        {browseOn && (
          <li>
            <Link href="/custdash/browse" className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--line)] p-2 text-[15px] font-bold text-[var(--ink)] no-underline">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[15px] font-extrabold text-[var(--ink-2)]">2</span>{h("Step2")}
            </Link>
          </li>
        )}
      </ol>
    </section>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] text-[var(--ink)]" data-testid="parent-home">
      {failed && <div role="alert" className="mb-3 rounded-xl border border-[#f3c0bb] p-3 text-[14px] text-[var(--red,#e21d27)]">{h("LoadFailed")}</div>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        {/* left / main column (and the whole page on a phone) */}
        <div className="flex min-w-0 flex-col gap-5">
          {greeting}
          {starter}
          {attentionBlock}
          {starter ? null : nextBlock}
          <div className="flex flex-col gap-5 lg:hidden">{starter ? null : childrenBlock}{tilesBlock}</div>
        </div>
        {/* right column: desktop only (phone already shows these inline above) */}
        <div className="hidden min-w-0 flex-col gap-5 lg:flex">
          {tilesBlock}
          {starter ? null : childrenBlock}
          {walletBlock}
          {newsBlock}
        </div>
      </div>
    </div>
  );
}
