"use client";

import { LIGHT_PALETTE } from "@/components/OperatorPage";

// Company Learning Centre — an in-app, richly-designed guide to what ActivityOS
// is, the build plan and the dev notes, ported from the Product Overview. Static
// content, so it's injected as one scoped HTML block (every selector is namespaced
// under .lc so it can never touch the rest of the app).
const LC_HTML = `<style>.lc{
    --navy:#101c4d; --navy2:#1a2e73; --blue:#2f6bd8; --blue2:#4f8bf5; --sky:#7fb0ff;
    --pink:#ff4d9d; --pink2:#ff8ac4; --teal:#0ea5a5; --green:#10b981; --green2:#34d399;
    --amber:#f59e0b; --red:#e04b57;
    --bg:#eef2fb; --surface:#ffffff; --panel:#f5f8ff; --card:#ffffff;
    --ink:#111634; --ink2:#41496e; --ink3:#7c85a8; --line:#e3e8f5; --line2:#eef1fa;
    --shadow:0 1px 3px rgba(16,24,64,.07); --shadowlg:0 22px 50px -30px rgba(16,32,90,.55);
    --ff:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
    --maxw:1080px;
  }@media (prefers-color-scheme:dark){.lc{ --bg:#080c1c; --surface:#111731; --panel:#0f1530; --card:#141b38; --ink:#eef1fb; --ink2:#b3bce0; --ink3:#7d87b0; --line:#232c4f; --line2:#1b2340; --shadow:0 1px 3px rgba(0,0,0,.4); --shadowlg:0 22px 54px -30px rgba(0,0,0,.75); }}.lc *{box-sizing:border-box}.lc{scroll-behavior:smooth}.lc{margin:0;background:var(--bg);color:var(--ink);font-family:var(--ff);-webkit-font-smoothing:antialiased;line-height:1.6;font-size:16px}.lc a{color:var(--blue);text-decoration:none}.lc h1, .lc h2, .lc h3, .lc h4{line-height:1.15;letter-spacing:-.02em;margin:0;text-wrap:balance}.lc .tnum{font-variant-numeric:tabular-nums}.lc /* ---- layout ---- */
  .shell{display:grid;grid-template-columns:248px minmax(0,1fr);gap:0;max-width:1320px;margin:0 auto}.lc nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;padding:26px 14px 40px 22px;border-right:1px solid var(--line)}.lc nav.toc .brand{display:flex;align-items:center;gap:9px;margin-bottom:6px}.lc nav.toc .mark{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;font-size:15px;background:linear-gradient(135deg,var(--blue2),var(--navy2));box-shadow:0 6px 14px -6px rgba(47,107,216,.7)}.lc nav.toc .logo{font-weight:900;font-size:19px;letter-spacing:-.03em}.lc nav.toc .logo b{color:var(--pink)}.lc nav.toc .tag{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin:2px 0 16px 39px}.lc nav.toc a.lnk{display:block;padding:7px 11px;border-radius:9px;font-size:13px;font-weight:600;color:var(--ink2);margin-bottom:1px}.lc nav.toc a.lnk:hover{background:var(--panel);color:var(--ink)}.lc nav.toc a.lnk .n{color:var(--ink3);font-weight:800;font-size:11px;margin-right:8px;font-variant-numeric:tabular-nums}.lc nav.toc .grp{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin:16px 0 5px 11px}.lc main{min-width:0;padding:0 clamp(20px,4vw,56px) 100px}@media(max-width:900px){.lc .shell{grid-template-columns:1fr}.lc nav.toc{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);display:none}.lc main{padding-top:8px}}.lc section{padding:52px 0 8px;scroll-margin-top:16px;border-top:1px solid var(--line2)}.lc section:first-of-type{border-top:0}.lc .eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--blue);background:color-mix(in srgb,var(--blue) 12%,transparent);padding:5px 11px;border-radius:999px;margin-bottom:14px}.lc h2.h{font-size:clamp(26px,3.4vw,36px);margin-bottom:10px}.lc .lede{font-size:17px;color:var(--ink2);max-width:70ch;margin:0 0 22px}.lc p{margin:0 0 14px;color:var(--ink2)}.lc main p strong, .lc main li strong{color:var(--ink)}.lc .muted{color:var(--ink3)}.lc .card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:20px 22px}.lc .grid{display:grid;gap:14px}.lc .g2{grid-template-columns:repeat(2,1fr)}.lc .g3{grid-template-columns:repeat(3,1fr)}.lc .g4{grid-template-columns:repeat(4,1fr)}@media(max-width:760px){.lc .g2, .lc .g3, .lc .g4{grid-template-columns:1fr}}.lc .tag2{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:6px}.lc .t-crit{background:#fdecec;color:#c0392b}.lc .t-key{background:#eaf1ff;color:#1d54c4}.lc .t-sens{background:#fff3e0;color:#b45309}@media(prefers-color-scheme:dark){.lc .t-crit{background:#3a1620;color:#ff8a95}.lc .t-key{background:#152a5e;color:#8fb4ff}.lc .t-sens{background:#3a2a12;color:#ffc477}}.lc /* hero */
  .hero{position:relative;overflow:hidden;border-radius:26px;margin-top:26px;padding:48px clamp(24px,4vw,52px);color:#fff;background:radial-gradient(120% 140% at 85% -10%,#2f6bd8 0%,#182a71 45%,#0d1741 100%)}.lc .hero::after{content:"";position:absolute;right:-80px;top:-90px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(255,77,157,.5),transparent 65%);filter:blur(30px)}.lc .hero .mark{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;font-size:26px;background:rgba(255,255,255,.14);backdrop-filter:blur(6px);margin-bottom:18px}.lc .hero h1{font-size:clamp(34px,6vw,60px);font-weight:900;letter-spacing:-.035em}.lc .hero h1 b{color:var(--pink2)}.lc .hero .sub{font-size:clamp(16px,2.2vw,20px);color:#d7e3ff;max-width:60ch;margin-top:14px;position:relative}.lc .hero .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px;position:relative}.lc .hero .chip{font-size:12.5px;font-weight:700;color:#eaf1ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);padding:7px 13px;border-radius:999px}.lc /* stat tiles */
  .stat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:var(--shadow)}.lc .stat .num{font-size:30px;font-weight:900;letter-spacing:-.03em;background:linear-gradient(120deg,var(--blue),var(--pink));-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.05}.lc .stat .lbl{font-size:12.5px;color:var(--ink2);margin-top:5px;font-weight:600}.lc .src{font-size:11.5px;color:var(--ink3);margin-top:6px}.lc /* feature callout */
  .callout{border-radius:20px;padding:26px 28px;color:#fff;background:linear-gradient(125deg,#0e7d74,#0a5c67 60%,#0d2b52);position:relative;overflow:hidden;box-shadow:var(--shadowlg)}.lc .callout::after{content:"";position:absolute;right:-60px;bottom:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(52,211,153,.4),transparent 65%)}.lc .callout .k{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8ff0d8}.lc .callout h3{font-size:24px;margin:6px 0 12px;position:relative}.lc .callout p{color:#d6f5ee;position:relative}.lc /* economics bar */
  .ebar{display:flex;height:52px;border-radius:12px;overflow:hidden;border:1px solid var(--line);margin:6px 0 14px}.lc .ebar span{display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;min-width:0}.lc .elegend{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(max-width:600px){.lc .elegend{grid-template-columns:1fr}}.lc .eitem{display:flex;gap:11px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.lc .eitem .dot{width:12px;height:12px;border-radius:4px;margin-top:4px;flex:none}.lc .eitem .v{font-size:18px;font-weight:900;letter-spacing:-.02em}.lc .eitem .d{font-size:12px;color:var(--ink3)}.lc /* projection cards */
  .proj{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:760px){.lc .proj{grid-template-columns:repeat(2,1fr)}}.lc .pc{border:1px solid var(--line);border-radius:16px;padding:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--green) 8%,var(--card)),var(--card))}.lc .pc .p{font-size:12px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em}.lc .pc .big{font-size:26px;font-weight:900;color:var(--green);letter-spacing:-.03em;margin-top:6px}.lc .pc .yr{font-size:12.5px;color:var(--ink2);margin-top:2px;font-weight:600}.lc /* roadmap chart */
  .rm{display:flex;align-items:flex-end;gap:10px;height:230px;padding:14px 6px 0;border-bottom:2px solid var(--line);position:relative}.lc .rm .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;min-width:0}.lc .rm .bar{width:64%;max-width:44px;border-radius:7px 7px 0 0;background:linear-gradient(180deg,var(--blue2),var(--navy2));position:relative}.lc .rm .bar.intl{background:linear-gradient(180deg,var(--pink2),var(--pink))}.lc .rm .v{font-size:12px;font-weight:800}.lc .rm .q{font-size:11px;color:var(--ink3);text-align:center;line-height:1.2}.lc .rm .target{position:absolute;left:0;right:0;top:8px;border-top:2px dashed var(--pink);}.lc .rm .target span{position:absolute;right:0;top:-9px;font-size:10px;font-weight:800;color:var(--pink);background:var(--bg);padding:0 5px}.lc /* portal diagram */
  .diagram{display:flex;flex-direction:column;align-items:center;gap:0;text-align:center}.lc .node{border:1.5px solid var(--line);border-radius:14px;padding:12px 16px;background:var(--card);min-width:190px;box-shadow:var(--shadow)}.lc .node .t{font-weight:800;font-size:14px}.lc .node .s{font-size:11.5px;color:var(--ink3)}.lc .node.hub{border-color:var(--pink);background:linear-gradient(180deg,color-mix(in srgb,var(--pink) 10%,var(--card)),var(--card))}.lc .node.tenant{border-color:var(--blue);background:linear-gradient(180deg,color-mix(in srgb,var(--blue) 9%,var(--card)),var(--card))}.lc .conn{width:2px;height:22px;background:var(--line)}.lc .rel{font-size:11px;font-weight:700;color:var(--ink3);padding:2px 0}.lc .row3{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}.lc /* portal page map */
  .portal{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--card);box-shadow:var(--shadow)}.lc .portal .hd{display:flex;align-items:center;gap:12px;padding:15px 18px;color:#fff}.lc .portal .hd .em{font-size:20px}.lc .portal .hd .nm{font-weight:800;font-size:16px}.lc .portal .hd .ds{font-size:11.5px;opacity:.85}.lc .portal .hd .ct{margin-left:auto;font-weight:900;font-size:15px;background:rgba(255,255,255,.18);padding:4px 11px;border-radius:999px}.lc .portal .bd{padding:14px 18px 16px;columns:2;column-gap:22px}@media(max-width:560px){.lc .portal .bd{columns:1}}.lc .portal .grp2{break-inside:avoid;margin-bottom:12px}.lc .portal .grp2 .gt{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}.lc .portal .grp2 .pg{font-size:13px;color:var(--ink2);padding:2px 0}.lc /* numbered scope list */
  .scope{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}@media(max-width:820px){.lc .scope{grid-template-columns:1fr}}.lc .si{border:1px solid var(--line);border-radius:14px;padding:16px 18px;background:var(--card);box-shadow:var(--shadow)}.lc .si .top{display:flex;align-items:center;gap:10px;margin-bottom:6px}.lc .si .no{width:26px;height:26px;flex:none;border-radius:8px;display:grid;place-items:center;font-weight:900;font-size:13px;color:#fff;background:linear-gradient(135deg,var(--blue2),var(--navy2))}.lc .si h4{font-size:15px}.lc .si .oneline{font-size:12.5px;color:var(--ink3);font-style:italic;margin:0 0 8px}.lc .si ul{margin:0;padding-left:18px}.lc .si li{font-size:13px;color:var(--ink2);margin-bottom:4px}.lc /* split you/me */
  .split{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.lc .split{grid-template-columns:1fr}}.lc .split .col{border-radius:16px;padding:20px 22px;border:1px solid var(--line)}.lc .split .you{background:linear-gradient(180deg,color-mix(in srgb,var(--blue) 8%,var(--card)),var(--card))}.lc .split .me{background:linear-gradient(180deg,color-mix(in srgb,var(--pink) 7%,var(--card)),var(--card))}.lc .split h4{font-size:16px;margin-bottom:2px}.lc .split .who{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-bottom:12px}.lc .chklist{list-style:none;margin:0;padding:0}.lc .chklist li{position:relative;padding:5px 0 5px 26px;font-size:13.5px;color:var(--ink2);border-top:1px solid var(--line2)}.lc .chklist li:first-child{border-top:0}.lc .chklist li::before{content:"";position:absolute;left:0;top:9px;width:15px;height:15px;border-radius:5px;background:var(--blue);opacity:.9}.lc .split .me .chklist li::before{background:var(--pink)}.lc /* layers */
  .layer{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--card);box-shadow:var(--shadow)}.lc .layer .lt{font-weight:800;font-size:14px;display:flex;align-items:center;gap:8px}.lc .layer .bi{font-size:10.5px;font-weight:800;color:var(--blue);background:color-mix(in srgb,var(--blue) 12%,transparent);padding:2px 7px;border-radius:6px}.lc .layer .lb{font-size:12.5px;color:var(--ink3);margin-top:4px}.lc /* week table */
  .wt{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;border:1px solid var(--line);border-radius:14px;overflow:hidden}.lc .wt th{background:var(--navy2);color:#fff;text-align:left;padding:11px 14px;font-size:11px;letter-spacing:.06em;text-transform:uppercase}.lc .wt td{padding:12px 14px;border-top:1px solid var(--line);vertical-align:top;color:var(--ink2)}.lc .wt tr:nth-child(even) td{background:var(--panel)}.lc .wt .wk{font-weight:900;color:var(--ink);width:38px}.lc .wt .dev{width:44%}.lc .wt .me{color:var(--pink);font-weight:600}.lc .wt .launch td{background:linear-gradient(90deg,color-mix(in srgb,var(--green) 16%,var(--card)),var(--card));font-weight:800;color:var(--ink);text-align:center;font-size:13.5px}.lc .pill{display:inline-flex;gap:7px;align-items:center;font-size:12.5px;font-weight:700;color:var(--ink2);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px}.lc ul.clean{margin:0 0 14px;padding-left:20px}.lc ul.clean li{margin-bottom:7px;color:var(--ink2)}.lc .kv{display:flex;gap:8px;font-size:13.5px;padding:8px 0;border-top:1px solid var(--line2)}.lc .kv:first-child{border-top:0}.lc .kv b{color:var(--ink);min-width:150px;flex:none}.lc footer{margin-top:60px;padding:26px 0;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}.lc .note{border-left:3px solid var(--amber);background:color-mix(in srgb,var(--amber) 8%,var(--card));padding:12px 16px;border-radius:0 12px 12px 0;font-size:13.5px;color:var(--ink2);margin:14px 0}.lc .note b{color:var(--ink)} .lc .lcnav{position:sticky;top:0;z-index:5;display:flex;gap:7px;overflow-x:auto;padding:11px 2px;margin-bottom:6px;background:var(--bg);border-bottom:1px solid var(--line)} .lc .lcnav a{flex:none;font-size:12px;font-weight:700;color:var(--ink2);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 12px;white-space:nowrap} .lc .lcnav a:hover{border-color:var(--blue);color:var(--blue)}</style>
<div class="lcnav"><a href="#what">What ActivityOS is</a><a href="#problem">The problem — and how ActivityOS fixes it</a><a href="#tfc">The feature that will win providers</a><a href="#economics">The economics, per average provider</a><a href="#forlife">The for-life share — your 20% of net</a><a href="#roadmap">Getting to 500 — a 2-year roadmap</a><a href="#role">The role — build, then partner</a><a href="#developer">The developer I need — this is you</a><a href="#portals">How the portals connect</a><a href="#pages">What's inside — every portal & page</a><a href="#scope">The foundation — your scope</a><a href="#specialists">Specialists to bring in separately</a><a href="#line">Where the line sits</a><a href="#screens">What my screens need from you</a><a href="#workflow">Me, you & Claude Code</a><a href="#timeline">Timeline & the week-by-week build</a><a href="#testing">Testing — how problems get caught</a><a href="#agree">What I'll agree with you</a><a href="#security">Security & data protection — committed, regardless of who builds it</a></div>

    <!-- HERO -->
    <div class="hero">
      <div class="mark">🚀</div>
      <h1>Activity<b>OS</b></h1>
      <div class="sub">The all-in-one, white-label platform that runs a UK children's activity business end to end — bookings, payments, registers, staff, safeguarding, ratios and finance — on one shared, multi-tenant codebase.</div>
      <div class="chips">
        <span class="chip">6 connected portals</span>
        <span class="chip">150 pages</span>
        <span class="chip">White-label &amp; multi-tenant</span>
        <span class="chip">Records-only money — never held by ActivityOS</span>
        <span class="chip">Tax-Free Childcare, auto-reconciled</span>
      </div>
    </div>

    <!-- 01 WHAT -->
    <section id="what">
      <span class="eyebrow">01 · The product</span>
      <h2 class="h">What ActivityOS is</h2>
      <p class="lede">A white-label, multi-tenant platform for running UK children's activity and holiday camps and clubs — bookings, payments, registers, staff, safeguarding, ratios and finance — on a single shared codebase.</p>
      <div class="grid g2">
        <div class="card">
          <h4 style="margin-bottom:8px">One codebase, every provider their own version</h4>
          <p>Each provider runs their own version — own data, staff and payments — choosing from a set of <b>themes I design and control with their own logo applied</b>, not bespoke branding. <b>APF Activity Camps</b> is the first.</p>
          <p>It's built for the UK for now (EYFS ratios, safeguarding, funded places). Making it work in other countries is a deliberate later phase, many months out — <b>not part of this build</b>.</p>
        </div>
        <div class="card">
          <h4 style="margin-bottom:8px">The money never touches ActivityOS</h4>
          <p>The <b>providers</b> are the operators who take the money — ActivityOS itself never holds or moves any of it. Each provider's takings go straight to their <b>own Stripe account</b>; ActivityOS only <b>records</b> payments and refunds for quality assurance and oversight.</p>
          <p>ActivityOS makes its money the other way round — each provider pays a <b>flat subscription fee</b> to use the platform (not commission on bookings).</p>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h4 style="margin-bottom:10px">Three web surfaces, kept clear</h4>
        <div class="grid g3">
          <div><div class="pill">1 · Marketing website</div><p style="margin-top:8px;font-size:13.5px">The public sales pages and sign-up form — <b>screens I build</b>, sitting on your provisioning engine and domain routing.</p></div>
          <div><div class="pill">2 · The app</div><p style="margin-top:8px;font-size:13.5px">The six portals — Platform, Company/Head&nbsp;Office, Franchise, Freelancer, Staff and Customer.</p></div>
          <div><div class="pill">3 · White-label storefront</div><p style="margin-top:8px;font-size:13.5px">One per provider, where parents browse and book — themed as them, paying through their own Stripe.</p></div>
        </div>
      </div>
      <div class="note">A complete <b>interactive prototype</b> of all six portals and every page and flow is already built — it is the single source of truth and the spec for this production build.</div>
    </section>

    <!-- 02 PROBLEM -->
    <section id="problem">
      <span class="eyebrow">02 · The market</span>
      <h2 class="h">The problem — and how ActivityOS fixes it</h2>
      <p class="lede">Working parents need childcare and activities all year — after school, and across the ~13 weeks of school holidays. The providers who deliver it run on a patchwork of booking tools, spreadsheets, group chats and paperwork. Today's software <b>takes the booking</b> but leaves the hard part — safeguarding, ratios, registers, trips, medical records, head-counts, finance, multi-site and franchise management — to manual graft.</p>
      <div class="grid g4">
        <div class="stat"><div class="num">60,000</div><div class="lbl">Ofsted-registered childcare providers (England)</div></div>
        <div class="stat"><div class="num">27,500</div><div class="lbl">on non-domestic premises — clubs, camps, out-of-school</div></div>
        <div class="stat"><div class="num">1.29m</div><div class="lbl">registered childcare places</div></div>
        <div class="stat"><div class="num">~13 wks</div><div class="lbl">of school holidays a year parents must cover</div></div>
      </div>
      <p class="src">Source: Ofsted / DfE, childcare providers &amp; inspections, England, Aug 2025.</p>
      <div class="grid g2" style="margin-top:16px">
        <div class="card">
          <h4 style="margin-bottom:8px">The competition is booking-led</h4>
          <p>Tools like <b>Class4Kids</b> (now part of The Access Group) and marketplaces like <b>eequ</b> and <b>Hoop</b> are good at taking bookings — but they're point solutions: not a complete operations platform, not white-label, and not built for multi-site companies or franchise networks.</p>
          <p>And the model makes real money even in a single niche: <b>Famly</b>, an early-years platform that does <b>nurseries only</b>, has raised ~<b>$24.5m</b> and is estimated to turn over ~<b>$13m/year</b> (external estimate) — a serious business built on one slice of childcare.</p>
        </div>
        <div class="card">
          <h4 style="margin-bottom:8px">ActivityOS runs the whole business</h4>
          <p>The all-in-one, white-label platform — not just the booking:</p>
          <ul class="clean" style="font-size:13.5px">
            <li><b>Bookings + safeguarding</b> — ratios, trips, registers, incidents, medication and head-counts.</li>
            <li><b>Finance</b> — reconciliation, payouts, royalty splits and automatic Tax-Free Childcare reconciliation.</li>
            <li><b>Multi-site companies &amp; franchise networks</b> — each provider running their own branded version.</li>
          </ul>
          <p style="margin:0">ActivityOS goes after the wider, under-served market the nursery tools don't touch — activity clubs, holiday camps and franchise networks.</p>
        </div>
      </div>
    </section>

    <!-- 03 TFC -->
    <section id="tfc">
      <span class="eyebrow">03 · The wedge</span>
      <h2 class="h">The feature that will win providers</h2>
      <div class="callout">
        <div class="k">Tax-Free Childcare, reconciled automatically</div>
        <h3>The admin job they dread most — gone</h3>
        <p>Almost every parent pays with government Tax-Free Childcare — and almost every provider reconciles it <b style="color:#fff">by hand</b>, matching payments to bookings one by one. Hardly any booking software touches it, because it means becoming an <b style="color:#fff">HMRC-approved payment provider (EPP)</b> — a bar very few clear.</p>
        <p>That's exactly what ActivityOS is built to do. Parents pay through Tax-Free Childcare <b style="color:#fff">right inside the app</b>, the money goes <b style="color:#fff">straight to the provider</b>, and the booking <b style="color:#fff">reconciles itself</b>. The job that eats hours every month just… happens. It's the single feature that will make a provider switch.</p>
      </div>
      <div class="note" style="margin-top:16px">And it travels. Because it's multi-tenant and configuration-driven, taking it abroad means swapping the country-specific layers (ratios, safeguarding rules, local payment &amp; childcare-funding) — <b>the core platform is reused, not rebuilt</b>. The hard engineering is done once; new countries are largely configuration.</div>
    </section>

    <!-- 04 ECONOMICS -->
    <section id="economics">
      <span class="eyebrow">04 · The deal</span>
      <h2 class="h">The economics, per average provider</h2>
      <p class="lede">Where each pound of a typical provider's <b>~£85/month</b> subscription goes — the blended average across freelancers (£29), companies (£39–£89) and franchises (a multiple of a company price). The developer's 20% for-life share is paid <b>before ActivityOS takes any profit</b>.</p>
      <div class="card">
        <div class="ebar">
          <span style="width:15%;background:linear-gradient(180deg,#7c86b8,#5a648f)">15%</span>
          <span style="width:5%;background:linear-gradient(180deg,#9aa3c9,#7a84ad);font-size:10px">5%</span>
          <span style="width:16%;background:linear-gradient(180deg,var(--green2),var(--green))">16%</span>
          <span style="width:64%;background:linear-gradient(180deg,var(--blue2),var(--navy2))">64%</span>
        </div>
        <div class="elegend">
          <div class="eitem"><span class="dot" style="background:#5a648f"></span><div><div class="v">£12.75</div><div class="d">Marketing (15%)</div></div></div>
          <div class="eitem"><span class="dot" style="background:#7a84ad"></span><div><div class="v">£4.25</div><div class="d">Platform fees (~5%)</div></div></div>
          <div class="eitem"><span class="dot" style="background:var(--green)"></span><div><div class="v">£13.60</div><div class="d">Developer — 20% of net, for life (16%)</div></div></div>
          <div class="eitem"><span class="dot" style="background:var(--navy2)"></span><div><div class="v">£54.40</div><div class="d">ActivityOS profit (64%)</div></div></div>
        </div>
        <div class="note" style="margin-top:14px;border-color:var(--green);background:color-mix(in srgb,var(--green) 8%,var(--card))"><b>What the developer earns:</b> £13.60 from every provider, every month — and it compounds with the network: <b>£680/mo at 50 providers → £3,400 at 250 → £6,800/mo at 500</b> (~£82k/year). For life. Your 20% is the first call on what's left after marketing and platform costs, and it keeps growing as the network grows. When a technical lead is later brought in to manage onboarding and new development, <b>that cost comes off ActivityOS's side — not yours</b>: your 20% stays whole.</div>
      </div>
      <div class="note"><b>To developers reading this:</b> I'm sharing this overview with several developers to compare approach, quality and cost before deciding who to work with. Read it through and come back with <b>how you'd build it and what you'd charge</b>. The clearer and more honest your plan for the risky pieces (multi-tenant security, payments, the HMRC integration), the better your chances.</div>
    </section>

    <!-- 05 FOR LIFE -->
    <section id="forlife">
      <span class="eyebrow">05 · The deal</span>
      <h2 class="h">The for-life share — your 20% of net</h2>
      <p class="lede">A share of net subscription income for as long as ActivityOS runs — small now, growing as the network grows. Illustrative, based on an even mix of freelancers, companies and franchises (~£85/provider average), 15% marketing and ~5% platform costs.</p>
      <div class="proj">
        <div class="pc"><div class="p">50 providers</div><div class="big">£680<span style="font-size:14px">/mo</span></div><div class="yr">~£8k / year</div></div>
        <div class="pc"><div class="p">100 providers</div><div class="big">£1,360<span style="font-size:14px">/mo</span></div><div class="yr">~£16k / year</div></div>
        <div class="pc"><div class="p">250 providers</div><div class="big">£3,400<span style="font-size:14px">/mo</span></div><div class="yr">~£41k / year</div></div>
        <div class="pc"><div class="p">500 providers</div><div class="big">£6,800<span style="font-size:14px">/mo</span></div><div class="yr">~£82k / year</div></div>
      </div>
      <div class="grid g3" style="margin-top:16px">
        <div class="card"><h4 style="margin-bottom:6px">Step 1 · Build</h4><p style="margin:0;font-size:13.5px">Build the foundation — the engines, once. Come to me with your build fee.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">Step 2 · Stay on &amp; grow</h4><p style="margin:0;font-size:13.5px">Fixing included. You manage someone to onboard providers &amp; build new features.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">Step 3 · Earn — for life</h4><p style="margin:0;font-size:13.5px">20% of net subscription income for as long as ActivityOS runs — growing as the network grows.</p></div>
      </div>
      <div class="note">Franchises are the heavy lifters, so the real figure tracks how many sign up. <b>What I need from you:</b> come to me with a build fee that takes the for-life share into account — the bigger the stake you're earning in step 3, the more competitive your build fee in step 1 should be. That's the trade.</div>
    </section>

    <!-- 06 ROADMAP -->
    <section id="roadmap">
      <span class="eyebrow">06 · The deal</span>
      <h2 class="h">Getting to 500 — a 2-year roadmap</h2>
      <p class="lede">Cumulative number of providers by quarter — UK first, then international in Year 2.</p>
      <div class="card">
        <div class="rm">
          <div class="target" style="top:8px"><span>target 500</span></div>
          <div class="col"><div class="v">5</div><div class="bar" style="height:3%"></div><div class="q">Q1<br>Launch (APF)</div></div>
          <div class="col"><div class="v">25</div><div class="bar" style="height:5%"></div><div class="q">Q2</div></div>
          <div class="col"><div class="v">55</div><div class="bar" style="height:11%"></div><div class="q">Q3</div></div>
          <div class="col"><div class="v">110</div><div class="bar" style="height:22%"></div><div class="q">Q4<br>End Yr1 · UK</div></div>
          <div class="col"><div class="v">175</div><div class="bar" style="height:35%"></div><div class="q">Q5</div></div>
          <div class="col"><div class="v">270</div><div class="bar intl" style="height:54%"></div><div class="q">Q6<br>Int'l launch</div></div>
          <div class="col"><div class="v">385</div><div class="bar intl" style="height:77%"></div><div class="q">Q7</div></div>
          <div class="col"><div class="v">500</div><div class="bar intl" style="height:100%"></div><div class="q">Q8<br>End Yr2 · 500</div></div>
        </div>
        <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;font-weight:700;color:var(--ink2)">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:var(--navy2)"></span>Year 1 — UK</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:var(--pink)"></span>Year 2 — UK + International</span>
        </div>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h4 style="margin-bottom:6px">In money (GBP)</h4><p style="margin:0;font-size:13.5px">At 500 providers that's roughly <b>£42,500/month</b> in subscriptions (~£510k/year). End of Year 1 (~110 providers) is roughly <b>£9,350/month</b>. Based on the ~£85/provider monthly average.</p></div>
        <div class="card" style="border-color:var(--amber);background:color-mix(in srgb,var(--amber) 6%,var(--card))"><h4 style="margin-bottom:6px">Honest note</h4><p style="margin:0;font-size:13.5px">Reaching 500 in two years is the <b>ambitious case</b>, and it leans on franchises and international. International isn't just more sales — each new country needs its country-specific layers rebuilt (ratios &amp; safeguarding, local payment &amp; funding, language), so it's development work as well as marketing. That's exactly what the ongoing technical partner is there to build.</p></div>
      </div>
    </section>

    <!-- 07 ROLE -->
    <section id="role">
      <span class="eyebrow">07 · The deal</span>
      <h2 class="h">The role — build, then partner</h2>
      <p class="lede">I'm not after a build-and-leave developer — I want you as a <b>technical partner</b> who builds the foundation, then grows with ActivityOS.</p>
      <div class="split">
        <div class="col you">
          <div class="who">Phase 1</div><h4>Build (reduced rate)</h4>
          <p style="font-size:13.5px">You build the foundation. In exchange for the ongoing role and revenue share, I'm asking for a <b>reduced build rate</b> — we share the early risk and the later reward. Exact rate to agree.</p>
        </div>
        <div class="col me">
          <div class="who">Phase 2</div><h4>Ongoing technical partner</h4>
          <p style="font-size:13.5px"><b>Bug-fixing &amp; maintenance included</b> — you keep it running and handle changes from Stripe, Supabase and HMRC. Provider onboarding and further development are handled by a <b>technical lead you bring in and oversee</b> once it's busy — a cost taken out of income before ActivityOS profit. You stay accountable for quality, not doing all the legwork.</p>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h4 style="margin-bottom:8px">How the build works</h4>
        <p style="margin:0">I hand you the finished prototype — that's the spec. <b>You build the foundation</b> (database, log-in, payments, email, file storage, plus the Tax-Free Childcare and booking functions). I then <b>rebuild the 52 screens myself in Claude Code</b> on top of that foundation, copying the one worked example you give me for each type. <b>You = the engines. Me = the screens.</b></p>
      </div>
    </section>

    <!-- 08 DEVELOPER -->
    <section id="developer">
      <span class="eyebrow">08 · The deal</span>
      <h2 class="h">The developer I need — this is you</h2>
      <p class="lede">A full-stack web developer who can confidently:</p>
      <div class="grid g2">
        <ul class="clean">
          <li>Build with <b>React / Next.js and TypeScript</b></li>
          <li>Set up a <b>Postgres database on Supabase</b>, including Row-Level Security (the multi-tenant data isolation)</li>
          <li>Integrate <b>Stripe</b> — Connect (marketplace payments) and Billing (subscriptions)</li>
          <li>Wire up third-party <b>REST APIs with OAuth</b> (for the HMRC Tax-Free Childcare integration)</li>
        </ul>
        <ul class="clean">
          <li>Handle <b>auth, file storage, webhooks and scheduled jobs</b></li>
          <li>Deploy on <b>Vercel</b> and work in a shared GitHub repo</li>
          <li>Be <b>careful with sensitive children's data</b> and get the multi-tenant isolation right</li>
          <li>Comfortable with <b>Claude Code</b> is a bonus</li>
        </ul>
      </div>
      <div class="note"><b>Experience:</b> you're mid-level (ideal), or a strong, careful junior — provided the security, payments and EPP pieces are reviewed by someone senior.</div>
    </section>

    <!-- 09 PORTALS -->
    <section id="portals">
      <span class="eyebrow">09 · The system</span>
      <h2 class="h">How the portals connect</h2>
      <p class="lede">Six connected portals and the relationships between them. Operators = Company / Franchise / Freelancer. Money is records-only — each provider's payments run through their own Stripe, never ActivityOS.</p>
      <div class="card">
        <div class="diagram">
          <div class="node hub"><div class="t">Platform — ActivityOS super-admin</div><div class="s">provisions &amp; oversees every provider</div></div>
          <div class="conn"></div><div class="rel">provisions · oversees</div><div class="conn"></div>
          <div class="node tenant"><div class="t">One provider (tenant)</div><div class="s">own data, payments, theme + logo</div></div>
          <div class="conn"></div>
          <div class="row3">
            <div class="node"><div class="t">Company / Head Office</div><div class="s">network HQ or independent</div></div>
            <div class="node"><div class="t">Franchise</div><div class="s">operator in the network</div></div>
            <div class="node"><div class="t">Freelancer</div><div class="s">solo operator</div></div>
          </div>
          <div class="rel">oversees · royalty split &nbsp;•&nbsp; employ &nbsp;•&nbsp; publish · take bookings</div>
          <div class="conn"></div>
          <div class="row3">
            <div class="node"><div class="t">Staff</div><div class="s">run the day</div></div>
            <div class="node"><div class="t">Customer</div><div class="s">parent — books</div></div>
          </div>
        </div>
      </div>
      <div class="note">Staff run the sessions the customer's children attend — attendance, ratios, medication, trips and safeguarding all recorded against the booking.</div>
    </section>

    <!-- 10 PAGES -->
    <section id="pages">
      <span class="eyebrow">10 · The system</span>
      <h2 class="h">What's inside — every portal &amp; page</h2>
      <p class="lede">A complete map of the prototype: <b>150 pages</b> across the six portals, grouped as they appear in the navigation. (Of these, <b>52 unique screen types</b> are the ones I rebuild in Claude Code.)</p>
      <div class="grid" style="gap:16px">
        <div class="portal">
          <div class="hd" style="background:linear-gradient(120deg,#3a1d6e,#6d3bd0)"><span class="em">🛰️</span><div><div class="nm">Platform</div><div class="ds">ActivityOS super-admin</div></div><span class="ct">9</span></div>
          <div class="bd">
            <div class="grp2"><div class="gt">Overview</div><div class="pg">Dashboard</div></div>
            <div class="grp2"><div class="gt">Tenants</div><div class="pg">Providers (tenants)</div><div class="pg">Provider features</div><div class="pg">Oversight</div><div class="pg">Billing</div><div class="pg">Support</div><div class="pg">AI assistant</div><div class="pg">Data &amp; privacy</div></div>
            <div class="grp2"><div class="gt">Communication</div><div class="pg">Messages</div><div class="pg">Email</div></div>
          </div>
        </div>
        <div class="portal">
          <div class="hd" style="background:linear-gradient(120deg,#0e2f6e,#2f6bd8)"><span class="em">🏢</span><div><div class="nm">Company / Head Office</div><div class="ds">Network HQ or independent company</div></div><span class="ct">25</span></div>
          <div class="bd">
            <div class="grp2"><div class="gt">Overview</div><div class="pg">Dashboard</div></div>
            <div class="grp2"><div class="gt">Run the day</div><div class="pg">Ratios &amp; groups</div><div class="pg">Trips &amp; visits</div><div class="pg">Registers</div><div class="pg">Pupils</div><div class="pg">Incidents</div><div class="pg">Medication</div><div class="pg">Accidents</div><div class="pg">Children</div><div class="pg">Moments</div></div>
            <div class="grp2"><div class="gt">Money</div><div class="pg">Finance</div><div class="pg">Payouts &amp; royalties</div><div class="pg">Reconciliation</div><div class="pg">Expenses</div><div class="pg">Purchasing &amp; invoices</div><div class="pg">Split fees</div></div>
            <div class="grp2"><div class="gt">Documents</div><div class="pg">Documents</div></div>
            <div class="grp2"><div class="gt">Marketing</div><div class="pg">Marketing</div></div>
            <div class="grp2"><div class="gt">Communication</div><div class="pg">Newsfeed / Daily updates</div><div class="pg">Messages</div></div>
            <div class="grp2"><div class="gt">Settings</div><div class="pg">Company setup</div><div class="pg">Settings &amp; features</div><div class="pg">Account</div></div>
            <div class="grp2"><div class="gt">Support</div><div class="pg">Support hub</div><div class="pg">Data &amp; privacy</div></div>
          </div>
        </div>
        <div class="portal">
          <div class="hd" style="background:linear-gradient(120deg,#0b4f57,#0ea5a5)"><span class="em">🎪</span><div><div class="nm">Franchise</div><div class="ds">Operator in a network (also independent companies)</div></div><span class="ct">36</span></div>
          <div class="bd">
            <div class="grp2"><div class="gt">Overview</div><div class="pg">Dashboard</div></div>
            <div class="grp2"><div class="gt">Sell &amp; take bookings</div><div class="pg">Listings</div><div class="pg">Sessions &amp; blocks</div><div class="pg">Bookings</div><div class="pg">Customers &amp; families</div></div>
            <div class="grp2"><div class="gt">Run the day</div><div class="pg">Ratios &amp; groups</div><div class="pg">Trips &amp; visits</div><div class="pg">Locations &amp; sites</div><div class="pg">Schedule &amp; rota</div><div class="pg">Calendar</div><div class="pg">Timetable</div><div class="pg">Tasks</div><div class="pg">Registers</div><div class="pg">Incidents</div><div class="pg">Medication</div><div class="pg">Accidents</div><div class="pg">Meals &amp; allergies</div><div class="pg">Moments</div><div class="pg">Pupils</div></div>
            <div class="grp2"><div class="gt">Your team</div><div class="pg">Staff</div><div class="pg">Payroll</div><div class="pg">Compliance &amp; certificates</div></div>
            <div class="grp2"><div class="gt">Money &amp; growth</div><div class="pg">Finance</div><div class="pg">Expenses</div><div class="pg">Purchasing &amp; invoices</div><div class="pg">Reconciliation</div><div class="pg">Subscription</div><div class="pg">AI assistant</div></div>
            <div class="grp2"><div class="gt">Communication</div><div class="pg">Newsfeed / Daily updates</div><div class="pg">Messages</div><div class="pg">Email</div></div>
            <div class="grp2"><div class="gt">Marketing</div><div class="pg">Marketing</div></div>
            <div class="grp2"><div class="gt">Settings</div><div class="pg">Settings &amp; features</div><div class="pg">Account</div><div class="pg">Support</div><div class="pg">Data &amp; privacy</div></div>
          </div>
        </div>
        <div class="portal">
          <div class="hd" style="background:linear-gradient(120deg,#7a3d09,#f59e0b)"><span class="em">👤</span><div><div class="nm">Freelancer</div><div class="ds">Solo operator</div></div><span class="ct">35</span></div>
          <div class="bd">
            <div class="grp2"><div class="gt">Overview</div><div class="pg">Dashboard</div></div>
            <div class="grp2"><div class="gt">Sell &amp; take bookings</div><div class="pg">Listings</div><div class="pg">Sessions &amp; blocks</div><div class="pg">Bookings</div><div class="pg">Customers &amp; families</div></div>
            <div class="grp2"><div class="gt">Run the day</div><div class="pg">Ratios &amp; groups</div><div class="pg">Trips &amp; visits</div><div class="pg">Locations &amp; sites</div><div class="pg">Schedule &amp; rota</div><div class="pg">Calendar</div><div class="pg">Timetable</div><div class="pg">Tasks</div><div class="pg">Registers</div><div class="pg">Incidents</div><div class="pg">Medication</div><div class="pg">Accidents</div><div class="pg">Meals &amp; allergies</div><div class="pg">Moments</div><div class="pg">Pupils</div></div>
            <div class="grp2"><div class="gt">Money</div><div class="pg">Finance</div><div class="pg">Expenses</div><div class="pg">Purchasing &amp; invoices</div><div class="pg">Analytics &amp; reports</div><div class="pg">Reconciliation</div><div class="pg">Subscription</div></div>
            <div class="grp2"><div class="gt">AI</div><div class="pg">AI assistant</div></div>
            <div class="grp2"><div class="gt">Communication</div><div class="pg">Newsfeed / Daily updates</div><div class="pg">Messages</div><div class="pg">Email</div></div>
            <div class="grp2"><div class="gt">Settings</div><div class="pg">Settings &amp; features</div><div class="pg">Account</div><div class="pg">Compliance &amp; certificates</div><div class="pg">Support</div><div class="pg">Data &amp; privacy</div></div>
            <div class="grp2"><div class="gt">Marketing</div><div class="pg">Marketing</div></div>
          </div>
        </div>
        <div class="portal">
          <div class="hd" style="background:linear-gradient(120deg,#0b5f3a,#10b981)"><span class="em">🧑‍🏫</span><div><div class="nm">Staff</div><div class="ds">Run the day on the ground</div></div><span class="ct">25</span></div>
          <div class="bd">
            <div class="grp2"><div class="gt">Overview</div><div class="pg">Dashboard</div></div>
            <div class="grp2"><div class="gt">My week</div><div class="pg">My schedule</div><div class="pg">My availability</div><div class="pg">My holiday</div><div class="pg">My tasks</div></div>
            <div class="grp2"><div class="gt">On shift</div><div class="pg">Ratios &amp; groups</div><div class="pg">Trips &amp; visits</div><div class="pg">Children</div><div class="pg">Timetable</div><div class="pg">Registers</div><div class="pg">Incidents</div><div class="pg">Medication</div><div class="pg">Accidents</div><div class="pg">Meals &amp; allergies</div><div class="pg">Moments</div><div class="pg">Pupils</div></div>
            <div class="grp2"><div class="gt">People</div><div class="pg">Families</div></div>
            <div class="grp2"><div class="gt">Resources</div><div class="pg">Training</div><div class="pg">Documents</div><div class="pg">AI assistant</div></div>
            <div class="grp2"><div class="gt">Communication</div><div class="pg">Messages</div><div class="pg">Daily updates</div></div>
            <div class="grp2"><div class="gt">Account</div><div class="pg">My expenses</div><div class="pg">My pay</div><div class="pg">Account</div><div class="pg">Data &amp; privacy</div></div>
          </div>
        </div>
        <div class="portal">
          <div class="hd" style="background:linear-gradient(120deg,#7a1147,#ff4d9d)"><span class="em">👪</span><div><div class="nm">Customer (parent)</div><div class="ds">The parent app</div></div><span class="ct">20</span></div>
          <div class="bd">
            <div class="grp2"><div class="gt">Home</div><div class="pg">Dashboard</div></div>
            <div class="grp2"><div class="gt">My child</div><div class="pg">Children</div><div class="pg">Moments</div><div class="pg">Newsfeed</div><div class="pg">Medication</div><div class="pg">Meals &amp; allergies</div><div class="pg">Accidents</div></div>
            <div class="grp2"><div class="gt">Activities</div><div class="pg">Browse &amp; book</div><div class="pg">Bookings</div><div class="pg">Schedule &amp; rota</div></div>
            <div class="grp2"><div class="gt">Payments</div><div class="pg">Payments</div><div class="pg">Memberships</div><div class="pg">Wallet</div><div class="pg">Coupons</div></div>
            <div class="grp2"><div class="gt">Account</div><div class="pg">Messages</div><div class="pg">AI assistant</div><div class="pg">Account</div><div class="pg">Data &amp; privacy</div><div class="pg">Help</div><div class="pg">Refer a friend</div></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 11 SCOPE -->
    <section id="scope">
      <span class="eyebrow">11 · The build · dev notes</span>
      <h2 class="h">The foundation — your scope</h2>
      <p class="lede">Built once, in my name, then handed over so I can build the screens on top. I build the <b>entire interface</b> myself — all six portals and every one of the 150 pages — in Claude Code. What I need a developer for is the <b>foundation underneath</b>: the parts that must be correct and secure before any child's data or real money moves.</p>
      <div class="scope">
        <div class="si"><div class="top"><span class="no">1</span><h4>Accounts &amp; ownership</h4></div><p class="oneline">Everything created and billed in my name — you work as a removable collaborator.</p><ul><li>Set up the GitHub org, Vercel, Supabase, domain registrar, Stripe and email/notification providers — all under my ownership &amp; billing.</li><li>You're an invited collaborator with no personal ownership, removable any time.</li><li>A full credentials &amp; access handover document at the end.</li></ul></div>
        <div class="si"><div class="top"><span class="no">2</span><h4>Code repository &amp; hosting</h4></div><p class="oneline">The app lives in my repo and deploys itself.</p><ul><li>A Next.js / React project in my GitHub, connected to Vercel.</li><li>Automatic deploy on every push, with separate staging and production.</li><li>Environment variables &amp; secrets handled properly — no keys in the code.</li></ul></div>
        <div class="si"><div class="top"><span class="no">3</span><h4>Monitoring, backups &amp; safe deploys</h4></div><p class="oneline">A safety net so building in Claude Code can't quietly break things.</p><ul><li>Error tracking with alerts (e.g. Sentry).</li><li>Automatic database backups with a restore that's actually been tested.</li><li>A preview deploy for every change and basic automated checks before anything reaches live.</li></ul></div>
        <div class="si"><div class="top"><span class="no">4</span><h4>Multi-tenant database</h4><span class="tag2 t-crit">Critical</span></div><p class="oneline">One shared database that keeps every provider's data fully separate.</p><ul><li>A Postgres schema (Supabase) with a tenant ID on every table.</li><li><b>Row-Level Security</b> so one provider can never read or touch another's data — the safeguard around children's records.</li><li>The account-type model (Platform, Company, Franchise, Freelancer, Staff, Customer), incl. independent company vs franchise.</li><li>Migrations &amp; seed data. Designs and agrees the data model (an <b>ERD</b>) up front, before any screens start.</li></ul></div>
        <div class="si"><div class="top"><span class="no">5</span><h4>Authentication, roles &amp; invites</h4></div><p class="oneline">Secure log-in, and the right person sees the right portal.</p><ul><li>Sign-up, sign-in, password reset and sessions.</li><li>Role-based permissions for all six portal types, plus finer roles (e.g. a site manager).</li><li>Invite flows: operators invite staff, Head Office invites franchises, parents self-register.</li><li>A per-role permission matrix <b>enforced server-side</b> — authorisation, not just log-in.</li></ul></div>
        <div class="si"><div class="top"><span class="no">6</span><h4>File &amp; media storage</h4><span class="tag2 t-sens">Sensitive</span></div><p class="oneline">Somewhere safe for photos, documents and certificates — locked down like the database.</p><ul><li>Access-controlled storage for children's photos (Moments), documents, staff certificates &amp; DBS, provider logos.</li><li>The same tenant isolation as the database.</li><li>Image upload, resizing and fast serving, plus a virus scan on upload.</li></ul></div>
        <div class="si"><div class="top"><span class="no">7</span><h4>Payments &amp; refunds via Stripe Connect</h4><span class="tag2 t-crit">Critical</span></div><p class="oneline">Providers get paid directly — ActivityOS never holds the money.</p><ul><li>Each provider connects their own Stripe account; card payments go straight to them.</li><li>Refunds instructed through Connect from the provider's own balance; ActivityOS records every payment &amp; refund.</li><li>ActivityOS's own Stripe <b>Billing</b> for the flat subscription fee; webhooks for payments, refunds &amp; subscription status.</li><li>Per-provider Stripe onboarding (KYC) before they can take money.</li><li>The hard money edges: partial refunds net of fee, insufficient balance, disputes/chargebacks, and reconciliation across card + TFC + vouchers + Universal Credit.</li></ul></div>
        <div class="si"><div class="top"><span class="no">8</span><h4>Tax-Free Childcare — HMRC EPP</h4><span class="tag2 t-key">Key</span></div><p class="oneline">Parents pay with Tax-Free Childcare inside the app, and it reconciles itself.</p><ul><li>Register ActivityOS as an HMRC-approved <b>EPP</b> — an application/approval process, so start it early.</li><li>Integrate HMRC's TFC Payments API: parent links their TFC account via Government Gateway, then check balance &amp; instruct payment.</li><li>Payment instructed directly to the provider (incl. the government top-up) — the money never touches ActivityOS.</li><li>Vouchers (Edenred, Computershare…) and Universal Credit aren't covered by this API and stay manual.</li></ul></div>
        <div class="si"><div class="top"><span class="no">9</span><h4>Email, notifications &amp; messaging</h4></div><p class="oneline">Reaching parents and staff reliably — email, push and in-app.</p><ul><li>A transactional email provider, per-provider sending domains authenticated (DKIM / SPF / DMARC).</li><li>Push notifications to parent &amp; staff apps, and an optional SMS channel for time-critical alerts.</li><li>The realtime layer behind in-app messages, the newsfeed and Moments.</li><li>Templated sends: booking confirmations, payment reminders, reconciliation notices.</li></ul></div>
        <div class="si"><div class="top"><span class="no">10</span><h4>Documents &amp; PDFs</h4></div><p class="oneline">Generating the paperwork the system produces.</p><ul><li>Invoices &amp; receipts; registers &amp; headcount sheets; staff certificates &amp; compliance docs; finance &amp; booking reports — generated server-side as PDFs.</li></ul></div>
        <div class="si"><div class="top"><span class="no">11</span><h4>Booking on the provider's own website</h4><span class="tag2 t-key">Key</span></div><p class="oneline">Parents can book and pay from a provider's existing website, not just ours.</p><ul><li>An embeddable "Book now" widget (script or iframe) they drop into their own site — themed as them, paying through their own Stripe.</li><li>A hosted storefront on their subdomain for providers who don't have a website.</li><li>Works securely across domains without breaking payments or log-in.</li></ul></div>
        <div class="si"><div class="top"><span class="no">12</span><h4>Tenant provisioning &amp; data import</h4></div><p class="oneline">Add a new provider without a developer, and don't make them start empty.</p><ul><li>A flow that spins up a new provider automatically — their space, subdomain and sensible defaults.</li><li>Import an existing provider's customers &amp; past bookings when they join (CSV / migration).</li><li>The public sign-up form calls this to create the provider and start their trial.</li></ul></div>
        <div class="si"><div class="top"><span class="no">13</span><h4>Domains &amp; routing — activityos.uk</h4></div><p class="oneline">Marketing site, the app, and a storefront per provider, all on one domain.</p><ul><li><b>activityos.uk</b> for marketing; <b>app.activityos.uk</b> for log-in and every back-office portal.</li><li>A storefront subdomain per provider (e.g. apf.activityos.uk), plus apply and referral links.</li><li>Wildcard subdomain routing and SSL on Vercel.</li></ul></div>
        <div class="si"><div class="top"><span class="no">14</span><h4>Scheduled jobs &amp; webhooks</h4></div><p class="oneline">The things that run automatically in the background.</p><ul><li>Scheduled / cron tasks — reminders, nightly reconciliation sweeps, housekeeping.</li><li>The webhook endpoints that receive Stripe, HMRC EPP and email events.</li></ul></div>
        <div class="si"><div class="top"><span class="no">15</span><h4>AI assistant integration</h4><span class="tag2 t-key">Phase 2</span></div><p class="oneline">Powers the in-app AI assistant that appears in several portals.</p><ul><li>A secure server-side connection to an AI model (e.g. the Claude API) — key kept on the server.</li><li>The assistant's context &amp; guardrails: only within that tenant, rate limiting &amp; cost controls.</li><li>Not needed for launch — can come after the first version is live.</li></ul></div>
        <div class="si"><div class="top"><span class="no">16</span><h4>Hand-off so I can build on top</h4></div><p class="oneline">Leave it documented and patterned so I can take over the screens.</p><ul><li>Documented schema, RLS policies and environment setup.</li><li>A <b>worked example for each service</b> (payments, storage, notifications, PDFs, booking widget) showing how a screen reads &amp; writes data.</li><li>Credentials handover — you can then be removed.</li><li>An empty page &amp; route for every portal and page — a blank shell I drop my UI into.</li></ul></div>
      </div>
      <div class="note" style="margin-top:16px"><b>Business rules I write down separately</b> (the prototype shows screens, not rules): cancellation &amp; refund tiers; ratio &amp; safeguarding rules (EYFS, SEND, allergies); royalty / split-fee rules; and reconciliation logic (matching card, TFC, vouchers &amp; Universal Credit). Also included in your scope: <b>Maps / address lookup</b> (dev provisions a key) for Locations &amp; sites and Trips &amp; visits.</div>
    </section>

    <!-- 12 SPECIALISTS -->
    <section id="specialists">
      <span class="eyebrow">12 · The build · dev notes</span>
      <h2 class="h">Specialists to bring in separately</h2>
      <p class="lede">Not the build developer — engaged on their own before launch.</p>
      <div class="grid g2">
        <div class="card"><h4 style="margin-bottom:6px">⚖️ Legal — data &amp; safeguarding</h4><p style="margin:0;font-size:13.5px">A data-processing agreement and a UK-GDPR review focused specifically on children's data and safeguarding.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">🛡️ Security — pre-launch review</h4><p style="margin:0;font-size:13.5px">A penetration test / security review before going live — multi-tenant isolation, the cross-domain booking embed and file storage as priorities.</p></div>
      </div>
    </section>

    <!-- 13 LINE -->
    <section id="line">
      <span class="eyebrow">13 · The build · dev notes</span>
      <h2 class="h">Where the line sits</h2>
      <p class="lede">So the split is unambiguous.</p>
      <div class="split">
        <div class="col you">
          <div class="who">You build — once</div><h4>The foundation</h4>
          <ul class="chklist">
            <li>Multi-tenant database + Row-Level Security</li>
            <li>Auth, roles &amp; invite flows</li>
            <li>File &amp; media storage</li>
            <li>Stripe Connect + subscription billing</li>
            <li>Tax-Free Childcare (HMRC EPP)</li>
            <li>Email, push &amp; in-app messaging</li>
            <li>Document &amp; PDF generation</li>
            <li>Booking widget for providers' own sites</li>
            <li>Tenant provisioning + data import</li>
            <li>Domains &amp; subdomain routing</li>
            <li>Scheduled jobs &amp; webhooks</li>
            <li>AI assistant integration (can be later)</li>
            <li>Maps &amp; address lookup</li>
            <li>Monitoring, backups &amp; safe deploys</li>
            <li>Accounts in my name + handover</li>
          </ul>
        </div>
        <div class="col me">
          <div class="who">I build myself — on top</div><h4>The whole surface</h4>
          <ul class="chklist">
            <li>All six portals &amp; every one of the 150 pages, in Claude Code</li>
            <li>The marketing-site pages &amp; content</li>
            <li>Product flows &amp; logic</li>
            <li>The theme presets + each provider's logo</li>
            <li>All copy and content</li>
            <li>The listing builder &amp; checkout experience</li>
            <li>Dashboards and reporting views</li>
            <li>Wiring the screens to the backend using your patterns</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 14 SCREENS -->
    <section id="screens">
      <span class="eyebrow">14 · The build · dev notes</span>
      <h2 class="h">What my screens need from you</h2>
      <p class="lede">I build all 52 screens myself. This shows which invisible <b>layer</b> underneath — built once by you — each screen sits on. A screen is the page I build; a layer is the engine that makes it work. I build the screen; you build the engine; my screen uses it.</p>
      <div class="grid g2">
        <div class="layer"><div class="lt">Database + log-in <span class="bi">items 4 &amp; 5</span></div><div class="lb">Every screen — reading and writing data, scoped to who's logged in.</div></div>
        <div class="layer"><div class="lt">Payments (Stripe Connect) <span class="bi">item 7</span></div><div class="lb">Browse &amp; book / checkout, Bookings, Reconciliation, Subscription, Parent payments &amp; wallet, Memberships, Coupons, Platform billing.</div></div>
        <div class="layer"><div class="lt">Booking widget + storefront <span class="bi">item 11</span></div><div class="lb">Browse &amp; book / checkout — and its embeddable version on the provider's own website.</div></div>
        <div class="layer"><div class="lt">Tax-Free Childcare EPP <span class="bi">item 8</span></div><div class="lb">Reconciliation (the auto side — vouchers &amp; Universal Credit are manual).</div></div>
        <div class="layer"><div class="lt">File &amp; media storage <span class="bi">item 6</span></div><div class="lb">Children / pupils, Moments, Incidents, Accidents, Expenses, Compliance &amp; certificates, Training, My child.</div></div>
        <div class="layer"><div class="lt">Email, messaging &amp; notifications <span class="bi">item 9</span></div><div class="lb">Email campaigns, Messages, Daily updates / newsfeed, Platform messages — plus the transactional emails almost every action sends, from each provider's own domain.</div></div>
        <div class="layer"><div class="lt">Documents &amp; PDFs <span class="bi">item 10</span></div><div class="lb">Registers, Purchasing &amp; invoices, Payroll, Analytics &amp; reports.</div></div>
        <div class="layer"><div class="lt">AI endpoint <span class="bi">item 15</span></div><div class="lb">AI assistant (Phase 2).</div></div>
        <div class="layer"><div class="lt">Maps / address lookup <span class="bi">dev key</span></div><div class="lb">Locations &amp; sites, Trips &amp; visits.</div></div>
      </div>
      <div class="note">Everything else is just <b>data + a screen</b> — mine to build. Going through the pages only added two things to your list: the <b>AI endpoint</b> (item 15) and the <b>maps key</b>.</div>
    </section>

    <!-- 15 WORKFLOW -->
    <section id="workflow">
      <span class="eyebrow">15 · The build · dev notes</span>
      <h2 class="h">Me, you &amp; Claude Code</h2>
      <p class="lede">The thing you and I share is the <b>code repository</b> (on GitHub, owned by me) — <b>not my Claude account</b>. You use your own tools, I use mine, both pointed at the same repo.</p>
      <div class="split">
        <div class="col you">
          <div class="who">What's shared</div><h4>One repo, one deployment</h4>
          <ul class="chklist">
            <li>The GitHub repository — my property; you're an invited collaborator</li>
            <li>Vercel auto-deploys whatever lands in the repo (staging + production)</li>
            <li>The Supabase / Stripe / email accounts — mine, you have collaborator access while building</li>
            <li>Everything reversible: remove your access and the work stays with me</li>
          </ul>
        </div>
        <div class="col me">
          <div class="who">What's separate</div><h4>Each of us logs in as ourselves</h4>
          <ul class="chklist">
            <li>I run Claude Code with my own Claude account (Pro or Max)</li>
            <li>You bring your own editor and your own Claude account/key — I never hand over mine</li>
            <li>We don't step on each other: you work on the foundation, I work on the screens, Git keeps it in sync</li>
            <li>Optional: a "@claude" GitHub bot to review changes — nice-to-have, not required</li>
          </ul>
        </div>
      </div>
      <div class="note">So, what I personally need: my own Claude subscription (Pro or Max) to run Claude Code, and the GitHub / Vercel / Supabase / Stripe / domain accounts in my name (set up with me on day one). That's it — you don't need anything from my Claude account; you need <b>collaborator access to the repo</b>.</div>
    </section>

    <!-- 16 TIMELINE -->
    <section id="timeline">
      <span class="eyebrow">16 · The plan · dev notes</span>
      <h2 class="h">Timeline &amp; the week-by-week build</h2>
      <p class="lede">Expected completion: <b>within 3 months</b>. The foundation is about <b>6–7 weeks</b> of work; I build the 52 screens myself in Claude Code from the prototype — the two run <b>in parallel</b>, both finishing inside the window. My experienced developer friend reviews the security, payments and EPP pieces.</p>
      <div style="overflow-x:auto">
      <table class="wt">
        <thead><tr><th>Wk</th><th class="dev">The developer builds (foundation + patterns)</th><th>I build (screens, Claude Code)</th></tr></thead>
        <tbody>
          <tr><td class="wk">1</td><td class="dev">Accounts in my name; repo + deploy + monitoring/backups. (I complete the HMRC EPP paperwork myself under K James Consultancy &amp; Headship Ltd t/a ActivityOS, and open Stripe — you only answer technical questions.)</td><td class="me">Learn Claude Code; build theme presets + logos; gather content</td></tr>
          <tr><td class="wk">2</td><td class="dev">Builds the database + log-in (the engine). Creates an empty page at the right address for each screen. → Fully builds <b>one example screen</b> to copy.</td><td class="me">Account · Settings &amp; features · Dashboards · Data &amp; privacy · Support/help · Refer a friend · Marketing · Provider features · Platform support</td></tr>
          <tr><td class="wk">3</td><td class="dev">Roles &amp; invites; file storage (start). Email &amp; notifications engine. → Builds one <b>list-with-detail</b> example.</td><td class="me">Timetable · Availability/holiday · Tasks · Training · Coupons · Meals · Medication · Expenses · Children · Staff</td></tr>
          <tr><td class="wk">4</td><td class="dev">File storage (finish); domains &amp; routing. → Builds one <b>file-upload</b> example.</td><td class="me">Customers &amp; families · Locations &amp; sites · Registers · Incidents · Accidents · Moments · Compliance &amp; certificates</td></tr>
          <tr><td class="wk">5</td><td class="dev">Payments + billing (start); in-app messaging / realtime. → Builds one <b>messaging</b> example.</td><td class="me">Ratios &amp; groups · Finance · Split fees · Parent dashboard · My child · Messages · Daily updates</td></tr>
          <tr><td class="wk">6</td><td class="dev">Payments (finish); booking widget (start). → Builds the <b>payment function</b> I call.</td><td class="me">Schedule &amp; rota · Payments &amp; wallet · Memberships · Subscription · Platform billing</td></tr>
          <tr><td class="wk">7</td><td class="dev">Booking widget (finish); Documents &amp; PDFs. → Builds the <b>booking + PDF</b> functions I call.</td><td class="me">Browse &amp; book / checkout · Bookings · Purchasing &amp; invoices · Payroll · Analytics &amp; reports</td></tr>
          <tr><td class="wk">8</td><td class="dev">Tax-Free Childcare EPP integration (production credentials now through). → Builds the <b>TFC function</b> I call.</td><td class="me">Reconciliation · Payouts &amp; royalties · Listings · Sessions &amp; blocks</td></tr>
          <tr><td class="wk">9</td><td class="dev">Provisioning + data import; email-campaign function.</td><td class="me">Email campaigns · Platform dashboard · Providers · Trips &amp; visits</td></tr>
          <tr><td class="wk">10</td><td class="dev">Jobs &amp; webhooks; hardening. AI assistant (screen; endpoint after launch).</td><td class="me">Catch up + polish any remaining screens</td></tr>
          <tr><td class="wk">11</td><td class="dev">Hardening + support. Legal + Security specialists (DPA/GDPR review, pen-test).</td><td class="me">Wire-up &amp; polish pass across all portals; fix review findings</td></tr>
          <tr><td class="wk">12</td><td class="dev">Hand-off finalised; support + fixes.</td><td class="me">Final wiring + polish; import APF data</td></tr>
          <tr class="launch"><td colspan="3">● END OF MONTH 3 — SOFT LAUNCH WITH APF, EVERYTHING LIVE ●</td></tr>
        </tbody>
      </table>
      </div>
      <div class="note"><b>Email is cross-cutting:</b> the email/notifications engine is built early (week 3) because actions all through the build send email — invites, confirmations, receipts, reminders. A screen built earlier simply gets its "send email" bit switched on once that engine is in. <b>How it flows:</b> you fully build one example screen of each type the moment that part of the foundation is ready; I copy that working example for every similar screen. So a fresh batch of screens opens up every week — the first example (week 2) alone unlocks most of them. Payment, booking and TFC screens come later because their safe-functions are built later. The HMRC paperwork starts day one so its ~10-day approval runs in the background; the integration and production credentials land around week 8.</div>
    </section>

    <!-- 17 TESTING -->
    <section id="testing">
      <span class="eyebrow">17 · The plan · dev notes</span>
      <h2 class="h">Testing — how problems get caught</h2>
      <p class="lede">Three layers, matched to who builds what — because not everything can be tested by clicking.</p>
      <div class="grid g3">
        <div class="card"><h4 style="margin-bottom:6px">I test my screens</h4><p style="margin:0;font-size:13.5px">For each screen: the happy path plus the obvious edge cases — empty, error, wrong role, lots of data. I have Claude Code write basic tests alongside each screen so a later change doesn't silently break an earlier one.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">You test the risky engines</h4><p style="margin:0;font-size:13.5px">Automated tests for payments, <b>tenant isolation</b> (a test that proves Provider A cannot load Provider B's data), and the Tax-Free Childcare flow. These are the things I can't reliably check by eye — yours to prove, not mine to guess.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">Always on staging first</h4><p style="margin:0;font-size:13.5px">Everything is tested on a staging copy with <b>fake data</b> first — never on real children's or parents' data.</p></div>
      </div>
      <div class="note"><b>When I get stuck:</b> if asking Claude in circles isn't fixing something, that's the signal to stop and hand it to you (support hours) or my experienced friend — not to keep patching until it "seems" to work. The trap on a children's-data app is that Claude can make a bug <b>look</b> fixed while leaving something subtly wrong — especially in security or payments. So for the risky areas, "I got Claude to make it work" is never the bar; those stay <b>your owned, tested functions that I only call</b>.</div>
    </section>

    <!-- 18 AGREE -->
    <section id="agree">
      <span class="eyebrow">18 · The contract</span>
      <h2 class="h">What I'll agree with you</h2>
      <p class="lede">The contract layer — so it's clean for both sides.</p>
      <div class="card">
        <div class="kv"><b>"Done" is defined up front</b><span>Each milestone has acceptance criteria (e.g. migrations run, the tenant-isolation test passes) — so "done" isn't an opinion.</span></div>
        <div class="kv"><b>I own everything</b><span>All accounts, keys and the production environment. You work as a removable collaborator; we test on a staging copy with fake data; secrets never live in code.</span></div>
        <div class="kv"><b>Branch &amp; review model</b><span>Feature branches with review before anything reaches production, so my screens and your engine code never collide and nothing untested ships.</span></div>
        <div class="kv"><b>Regulatory carve-outs</b><span>HMRC EPP approval and Stripe verification are my regulatory process, not your deliverable — they can't blow your timeline. The schedule is a target, not a fixed-date promise.</span></div>
        <div class="kv"><b>Support boundary</b><span>You own and support the engines, safe functions and documented patterns. Debugging my AI-generated screen code is mine — escalated to you only when it's genuinely an engine issue.</span></div>
        <div class="kv"><b>Booking embed scope</b><span>Targets a defined set (a script embed + a hosted fallback page), not "any website ever."</span></div>
        <div class="kv"><b>IP is mine</b><span>All code and data belong to ActivityOS / my company; the revenue share does not change ownership.</span></div>
      </div>
    </section>

    <!-- 19 SECURITY -->
    <section id="security">
      <span class="eyebrow">19 · The commitment</span>
      <h2 class="h">Security &amp; data protection — committed, regardless of who builds it</h2>
      <p class="lede">This is a children's-data platform, so two things happen before launch no matter what — and neither depends on the build developer. If they don't do it, a specialist does.</p>
      <div class="grid g3">
        <div class="card"><h4 style="margin-bottom:6px">🛡️ Independent penetration test</h4><p style="margin:0;font-size:13.5px">An external specialist attacks the finished app on purpose to prove one provider can never see another's children or data, and that payments, the booking embed and file storage are sound. Booked early, runs ~week 11, and <b>gates launch</b>.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">🗄️ GDPR mechanics in the software</h4><p style="margin:0;font-size:13.5px">A build task, not just a policy: data export &amp; deletion on request, retention rules, an <b>audit log of who accessed which child's record</b>, and consent records. Foundation work you build in.</p></div>
        <div class="card"><h4 style="margin-bottom:6px">⚖️ UK-GDPR / data-protection review</h4><p style="margin:0;font-size:13.5px">A legal/privacy specialist reviews the DPA, privacy policy and data-sharing setup. I am the <b>data controller</b> for children's data — required, not optional, and independent of the money never touching me.</p></div>
      </div>
      <div class="note">In short: the build developer builds securely (RLS, isolation, secure payments) — but the independent pen test and the GDPR/legal review are <b>committed separate steps</b> done before go-live whoever ends up building it. My experienced developer friend reviews the risky pieces during the build; the independent test is separate and still happens.</div>
    </section>

    <footer>
      <p style="margin-bottom:6px"><b>ActivityOS — Learning Centre.</b> Built as a complete interactive prototype (APF Activity Camps as the first provider). Page names are the working labels from the prototype; the production build rebuilds these on a multi-tenant foundation. UK-only for now — international is a later phase.</p>
      <p style="margin:0">All figures in GBP (£); illustrative, not a forecast. Money is records-only — each provider's payments run through their own Stripe, never ActivityOS.</p>
    </footer>
  `;

export function LearningCentreApp() {
  return (
    <div className="lc -m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <div dangerouslySetInnerHTML={{ __html: LC_HTML }} />
    </div>
  );
}
