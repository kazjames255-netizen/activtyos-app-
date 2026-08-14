// Course-completion certificates — 10 premium, print-ready templates.
// Each is a self-contained HTML+CSS document (own print window / isolated
// <iframe srcdoc> for previews), so class names never clash. Every template
// takes a resolved ACCENT colour (recolourable by the provider) and honours
// section options (title text, show/hide score, expiry and QR). Typography uses
// Google Fonts (Cinzel / Cormorant Garamond / Great Vibes / Montserrat / Josefin
// Sans) loaded in certificateDoc, falling back to system serif/sans offline.
import { qrSvg } from "./qr";

export interface CertData {
  name: string;          // staff member's name
  course: string;        // course title
  pct: number;           // quiz score %
  date: string;          // formatted completion date
  expiry?: string;       // formatted "renew by" date
  provider: string;      // company / provider name
  logo?: string;         // provider logo (data URL)
  ref: string;           // verification reference
  signImg?: string;      // signature image (data URL)
  signName?: string;     // signatory name
  signRole?: string;     // signatory role/title
  verifyUrl?: string;    // QR target (defaults to activityos.uk/v/<ref>)
  // ——— simple customisation ———
  accent?: string;       // accent colour (hex) — overrides the template's default
  title?: string;        // heading, e.g. "Certificate of Achievement"
  showScore?: boolean;   // default true
  showExpiry?: boolean;  // default true (only shown if expiry present)
  showQr?: boolean;      // default true
}

const F_TITLE = "'Cinzel',Georgia,serif";
const F_SCRIPT = "'Great Vibes','Snell Roundhand',cursive";
const F_BODY = "'Cormorant Garamond',Georgia,serif";
const F_SANS = "'Montserrat',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const F_LABEL = "'Josefin Sans','Montserrat',sans-serif";

const esc = (s = "") => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
export const makeRef = (seed: string) => "AOS-" + Math.abs([...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).toUpperCase().slice(0, 8);
const mix = (a: string, other: string, pct: number) => `color-mix(in srgb, ${a} ${pct}%, ${other})`;
const soft = (a: string, p = 8) => mix(a, "#fff", p);
const dark = (a: string, p = 78) => mix(a, "#000", p);
const titleOf = (d: CertData, fallback: string) => esc(d.title || fallback);
const logoImg = (d: CertData, cls = "logo") => (d.logo ? `<img class="${cls}" src="${d.logo}" alt="${esc(d.provider)}"/>` : "");
const sig = (d: CertData) => `<div class="sig">${d.signImg ? `<img class="sigimg" src="${d.signImg}" alt="Signature"/>` : ""}<div class="sigline"></div><div class="signame">${esc(d.signName || d.provider)}</div><div class="sigrole">${esc(d.signRole || "Authorised signatory")}</div></div>`;

const starPts = (cx: number, cy: number, outer: number, inner: number) => { let p = ""; for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? inner : outer; p += `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)} `; } return p.trim(); };
// clean classic medallion — ribbon tails, smooth double ring, a subtle bead ring
// and a crisp central star, tinted to the accent.
const seal = (a: string) => {
  const cx = 60, cy = 54;
  const beads = Array.from({ length: 24 }, (_, i) => { const ang = (i / 24) * Math.PI * 2; return `<circle cx="${(cx + Math.cos(ang) * 30).toFixed(1)}" cy="${(cy + Math.sin(ang) * 30).toFixed(1)}" r="1.2" fill="#fff" opacity="0.7"/>`; }).join("");
  return `<svg class="seal" viewBox="0 0 120 138" aria-hidden="true"><path d="M40 90 L32 132 L60 116 L88 132 L80 90 Z" fill="${a}"/><path d="M40 90 L32 132 L60 116 L88 132 L80 90 Z" fill="#000" opacity=".16"/><circle cx="${cx}" cy="${cy}" r="34" fill="${a}"/><circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${dark(a, 78)}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="#fff" stroke-width="1" opacity=".5"/>${beads}<circle cx="${cx}" cy="${cy}" r="23" fill="${dark(a, 88)}"/><circle cx="${cx}" cy="${cy}" r="23" fill="none" stroke="#fff" stroke-width="1.2" opacity=".6"/><polygon points="${starPts(cx, cy, 15, 6.2)}" fill="#fff"/></svg>`;
};
// detailed laurel wreath — two symmetric leafed branches, a ringed star and a ribbon
const laurel = (a: string) => {
  const leaves = (mir: boolean) => { const s = mir ? -1 : 1; return [[46, 52, -58], [42, 63, -47], [40, 75, -35], [43, 87, -23], [50, 98, -11], [60, 106, 2]].map(([x, y, r]) => { const X = 80 - s * (80 - x); const rot = mir ? -r : r; return `<ellipse cx="${X}" cy="${y}" rx="7.5" ry="3.4" transform="rotate(${rot} ${X} ${y})" fill="${a}"/><ellipse cx="${X}" cy="${y}" rx="7.5" ry="3.4" transform="rotate(${rot} ${X} ${y})" fill="#fff" opacity=".1"/>`; }).join(""); };
  return `<svg class="laurel" viewBox="0 0 160 134" aria-hidden="true"><g fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round"><path d="M80 112 C50 104 35 82 35 50"/><path d="M80 112 C110 104 125 82 125 50"/></g>${leaves(false)}${leaves(true)}<circle cx="80" cy="66" r="17" fill="none" stroke="${a}" stroke-width="1.4"/><text x="80" y="75" text-anchor="middle" font-family="${F_TITLE}" font-size="27" fill="${a}">★</text><path d="M62 114 h36 l-6 13 h-24 z" fill="${a}"/><path d="M62 114 h36 l-6 13 h-24 z" fill="#000" opacity=".12"/></svg>`;
};

const metaCell = (label: string, val: string) => `<div class="mcell"><span class="mk">${esc(label)}</span><b class="mv">${esc(val)}</b></div>`;
const verifyUrlOf = (d: CertData) => d.verifyUrl || `https://activityos.uk/v/${d.ref}`;
// framed verification QR for the bottom of the certificate
const qrFoot = (d: CertData) => { if (d.showQr === false) return ""; const url = verifyUrlOf(d); return `<div style="display:flex;align-items:center;gap:11px;font-family:${F_SANS}"><span style="display:inline-block;background:#fff;padding:6px;border-radius:9px;box-shadow:0 1px 5px rgba(0,0,0,.22)">${qrSvg(url, 74)}</span><div style="text-align:left;line-height:1.4"><div style="font-size:8.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.55">Scan to verify</div><div style="font-size:10px;opacity:.85">${esc(url)}</div><div style="font-size:10px;opacity:.6">Ref ${esc(d.ref)}</div></div></div>`; };
const metaRow = (d: CertData) => `<div class="meta">${[d.showScore === false ? "" : metaCell("Score", d.pct + "%"), metaCell("Completed", d.date), d.showExpiry === false || !d.expiry ? "" : metaCell("Renew by", d.expiry)].join("")}</div>`;

export interface CertTemplate { id: string; name: string; desc: string; accent: string; render: (d: CertData, a: string) => string }

export const CERT_TEMPLATES: CertTemplate[] = [
  // 1 — Aurelia · classic gold, script name, filigree frame
  { id: "gold", name: "Aurelia — Classic", desc: "Cream & gold, script name, filigree frame", accent: "#a9832f", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fdfaf1;color:#332a17;font-family:${F_BODY};padding:26px;position:relative}
    .frame{border:2px solid var(--a);outline:1px solid ${soft(a, 55)};outline-offset:9px;min-height:648px;padding:52px 70px;text-align:center;position:relative;background:radial-gradient(circle at 50% 36%, ${soft(a, 6)}, transparent 62%)}
    .cn{position:absolute;width:26px;height:26px;border:2px solid var(--a)}.cn.tl{top:10px;left:10px;border-right:0;border-bottom:0}.cn.tr{top:10px;right:10px;border-left:0;border-bottom:0}.cn.bl{bottom:10px;left:10px;border-right:0;border-top:0}.cn.br{bottom:10px;right:10px;border-left:0;border-top:0}
    .logo{max-height:52px;margin:0 auto 6px;display:block}.provider{font-family:${F_LABEL};font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:${dark(a, 70)}}
    h1{font-family:${F_TITLE};font-weight:600;font-size:34px;letter-spacing:.16em;text-transform:uppercase;color:var(--a);margin:22px 0 2px}
    .pres{font-size:17px;color:#7a6a44;margin-top:14px}
    .name{font-family:${F_SCRIPT};font-size:64px;color:#1e1708;line-height:1.05;margin:2px 0}
    .rule{width:340px;height:1px;background:linear-gradient(90deg,transparent,var(--a),transparent);margin:6px auto 16px}
    .for{font-size:17px;color:#7a6a44}.course{font-family:${F_TITLE};font-weight:600;font-size:23px;margin:4px 0;color:#2a2208}
    .meta{display:flex;justify-content:center;gap:44px;margin-top:26px;font-family:${F_SANS}}.mk{font-size:10px;color:${dark(a, 62)};text-transform:uppercase;letter-spacing:.1em}.mv{display:block;font-size:15px;color:#2a2208;margin-top:3px}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:34px}
    .sig{text-align:center;min-width:210px;font-family:${F_SANS}}.sigimg{max-height:44px;display:block;margin:0 auto -2px}.sigline{border-top:1.4px solid #4a3f22;width:200px;margin:0 auto 6px}.signame{font-weight:700;font-size:14px}.sigrole{font-size:11px;color:${dark(a, 60)}}
    .seal{width:96px;height:100px}
  </style><div class="page"><div class="frame"><span class="cn tl"></span><span class="cn tr"></span><span class="cn bl"></span><span class="cn br"></span>${logoImg(d)}<div class="provider">${esc(d.provider)}</div><h1>${titleOf(d, "Certificate of Achievement")}</h1><div class="pres">This certificate is proudly presented to</div><div class="name">${esc(d.name)}</div><div class="rule"></div><div class="for">for successfully completing</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}${seal(a)}</div></div></div>` },

  // 2 — Sovereign · navy panel + gold seal (the 2026 blue+gold classic)
  { id: "navy", name: "Sovereign — Navy & Gold", desc: "Deep panel header, gold seal, formal", accent: "#c39a3f", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fff;color:#141b33;font-family:${F_BODY};border:1px solid #e6e9f2;overflow:hidden}
    .top{background:linear-gradient(135deg,#141d3b,#1f2a52);color:#fff;padding:34px 56px 30px;text-align:center;position:relative}
    .top:after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,transparent,var(--a),transparent)}
    .top .logo{max-height:46px;margin:0 auto 8px;display:block;filter:brightness(0) invert(1)}
    .top .pv{font-family:${F_LABEL};font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:${soft(a, 70)}}
    h1{font-family:${F_TITLE};font-weight:600;font-size:30px;letter-spacing:.2em;text-transform:uppercase;color:#fff;margin:8px 0 0}
    .body{padding:34px 56px 40px;text-align:center;position:relative}
    .seal{width:96px;height:100px;position:absolute;right:48px;top:-52px}
    .pres{font-size:17px;color:#5a627e}.name{font-family:${F_SCRIPT};font-size:58px;color:#1f2a52;margin:2px 0 2px}
    .rule{width:300px;height:1px;background:linear-gradient(90deg,transparent,var(--a),transparent);margin:4px auto 16px}
    .for{font-size:17px;color:#5a627e}.course{font-family:${F_TITLE};font-weight:600;font-size:22px;margin:4px 0;color:#141b33}
    .meta{display:flex;justify-content:center;gap:40px;margin-top:24px;font-family:${F_SANS}}.mk{font-size:10px;color:#8b93ad;text-transform:uppercase;letter-spacing:.1em}.mv{display:block;font-size:15px;margin-top:3px;color:#1f2a52}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px}.sig{text-align:center;min-width:220px;font-family:${F_SANS}}.sigimg{max-height:44px;display:block;margin:0 auto -2px}.sigline{border-top:1.4px solid #141b33;width:210px;margin:0 auto 6px}.signame{font-weight:700;font-size:14px}.sigrole{font-size:11px;color:#8b93ad}
  </style><div class="page"><div class="top">${logoImg(d)}<div class="pv">${esc(d.provider)}</div><h1>${titleOf(d, "Certificate of Completion")}</h1></div><div class="body">${seal(a)}<div class="pres">This is presented to</div><div class="name">${esc(d.name)}</div><div class="rule"></div><div class="for">in recognition of successfully completing</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}<div class="sig"><div class="sigline"></div><div class="signame">${esc(d.date)}</div><div class="sigrole">Date of completion</div></div></div></div></div>` },

  // 3 — Aria · elegant minimal, generous whitespace
  { id: "elegant", name: "Aria — Elegant", desc: "Airy, refined serif, hairline accent", accent: "#8a7b52", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fff;color:#2b2a27;font-family:${F_BODY};padding:34px}
    .frame{border:1px solid ${soft(a, 45)};min-height:634px;padding:64px 90px;text-align:center;position:relative}
    .logo{max-height:46px;margin:0 auto 8px;display:block}.provider{font-family:${F_LABEL};font-size:11px;letter-spacing:.4em;text-transform:uppercase;color:${dark(a, 55)}}
    h1{font-family:${F_TITLE};font-weight:500;font-size:20px;letter-spacing:.44em;text-transform:uppercase;color:var(--a);margin:34px 0 0}
    .name{font-family:${F_BODY};font-weight:600;font-size:56px;color:#1c1b18;margin:24px 0 6px;letter-spacing:.01em}
    .flo{color:var(--a);font-size:18px;letter-spacing:.5em;margin-bottom:14px}
    .for{font-size:18px;font-style:italic;color:#6b655a}.course{font-family:${F_TITLE};font-weight:500;font-size:23px;letter-spacing:.04em;margin:8px 0 2px}
    .meta{display:flex;justify-content:center;gap:52px;margin-top:34px;font-family:${F_SANS}}.mk{font-size:10px;color:${dark(a, 52)};text-transform:uppercase;letter-spacing:.12em}.mv{display:block;font-size:15px;margin-top:4px}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:44px}.sig{text-align:center;min-width:230px;font-family:${F_SANS}}.sigimg{max-height:44px;display:block;margin:0 auto -2px}.sigline{border-top:1px solid #2b2a27;width:220px;margin:0 auto 6px}.signame{font-size:14px;font-weight:600}.sigrole{font-size:11px;color:${dark(a, 52)};font-style:italic}
    .seal{width:78px;height:82px}
  </style><div class="page"><div class="frame">${logoImg(d)}<div class="provider">${esc(d.provider)}</div><h1>${titleOf(d, "Certificate of Excellence")}</h1><div class="name">${esc(d.name)}</div><div class="flo">&#10022; &#10022; &#10022;</div><div class="for">has successfully completed</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}${seal(a)}</div></div></div>` },

  // 4 — Meridian · clean corporate, accent side rule
  { id: "corporate", name: "Meridian — Corporate", desc: "Modern sans, accent rail, structured", accent: "#2352c9", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fff;color:#161d2e;font-family:${F_SANS};display:flex;border:1px solid #e6e9f2}
    .rail{width:14px;background:linear-gradient(180deg,var(--a),${dark(a, 70)})}
    .body{flex:1;padding:52px 58px 44px;position:relative}
    .head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eef1f7;padding-bottom:18px}.head .logo{max-height:40px}.head .pv{font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--a)}
    h1{font-family:${F_TITLE};font-weight:600;font-size:26px;letter-spacing:.14em;text-transform:uppercase;margin:40px 0 4px;color:#161d2e}
    .pres{font-size:14px;color:#5a627e}.name{font-size:44px;font-weight:800;letter-spacing:-.01em;color:var(--a);margin:6px 0 8px}
    .nb{width:64px;height:4px;background:var(--a);border-radius:2px;margin-bottom:20px}
    .for{font-size:14px;color:#5a627e}.course{font-size:23px;font-weight:700;margin-top:3px}
    .meta{display:flex;gap:38px;margin-top:34px;font-family:${F_SANS}}.mk{font-size:10px;color:#8b93ad;text-transform:uppercase;letter-spacing:.08em}.mv{display:block;font-size:15px;margin-top:3px;font-weight:600}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:34px}.sig{min-width:220px}.sigimg{max-height:42px;display:block;margin-bottom:-2px}.sigline{border-top:1.5px solid #161d2e;width:210px;margin-bottom:6px}.signame{font-weight:700;font-size:14px}.sigrole{font-size:11px;color:#8b93ad}
    .meta{justify-content:flex-start}
  </style><div class="page"><div class="rail"></div><div class="body"><div class="head">${d.logo ? logoImg(d) : `<div style="font-size:20px;font-weight:800;color:var(--a)">${esc(d.provider)}</div>`}<div class="pv">${esc(d.provider)}</div></div><h1>${titleOf(d, "Certificate of Completion")}</h1><div class="pres">This certifies that</div><div class="name">${esc(d.name)}</div><div class="nb"></div><div class="for">has successfully completed</div><div class="course">${esc(d.course)}</div><div style="text-align:left">${metaRow(d)}</div><div class="foot">${qrFoot(d)}${sig(d)}<div style="text-align:right;font-size:12px;color:#8b93ad;font-family:${F_SANS}">Issued ${esc(d.date)}</div></div></div></div>` },

  // 5 — Laurel · centred wreath emblem, celebratory
  { id: "ribbon", name: "Laurel — Achievement", desc: "Laurel wreath emblem, refined & warm", accent: "#b98a2e", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fffdf7;color:#33280f;font-family:${F_BODY};border:3px double var(--a);padding:44px 64px;text-align:center;position:relative;background:radial-gradient(circle at 50% 30%, ${soft(a, 7)}, #fffdf7 60%)}
    .logo{max-height:42px;margin:0 auto 2px;display:block}.provider{font-family:${F_LABEL};font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:${dark(a, 60)}}
    .laurel{width:150px;height:112px;margin:6px auto -6px;display:block}
    h1{font-family:${F_TITLE};font-weight:600;font-size:26px;letter-spacing:.2em;text-transform:uppercase;color:var(--a);margin:2px 0 0}
    .pres{font-size:16px;color:#7a6a40;margin-top:12px}.name{font-family:${F_SCRIPT};font-size:58px;color:#33280f;margin:0}
    .rule{width:280px;height:1px;background:linear-gradient(90deg,transparent,var(--a),transparent);margin:4px auto 14px}
    .for{font-size:16px;color:#7a6a40}.course{font-family:${F_TITLE};font-weight:600;font-size:22px;margin-top:4px}
    .meta{display:flex;justify-content:center;gap:40px;margin-top:24px;font-family:${F_SANS}}.mk{font-size:10px;color:${dark(a, 58)};text-transform:uppercase;letter-spacing:.1em}.mv{display:block;font-size:15px;margin-top:3px}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px}.sig{text-align:center;min-width:210px;font-family:${F_SANS}}.sigimg{max-height:42px;display:block;margin:0 auto -2px}.sigline{border-top:1.4px solid #33280f;width:200px;margin:0 auto 6px}.signame{font-weight:700;font-size:14px}.sigrole{font-size:11px;color:${dark(a, 58)}}
  </style><div class="page">${logoImg(d)}<div class="provider">${esc(d.provider)}</div>${laurel(a)}<h1>${titleOf(d, "Certificate of Achievement")}</h1><div class="pres">Awarded to</div><div class="name">${esc(d.name)}</div><div class="rule"></div><div class="for">for successfully completing</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}<div class="sig"><div class="sigline"></div><div class="signame">${esc(d.date)}</div><div class="sigrole">Date awarded</div></div></div></div>` },

  // 6 — Monolith · minimal, huge type
  { id: "minimal", name: "Monolith — Minimal", desc: "Bold type, generous whitespace, accent underline", accent: "#111318", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fff;color:#0e0f12;font-family:${F_SANS};padding:64px 74px;display:flex;flex-direction:column}
    .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--a);padding-bottom:16px}.top .logo{max-height:38px}.top .pv{font-size:11px;letter-spacing:.24em;text-transform:uppercase;font-weight:700}
    .eyebrow{margin-top:52px;font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:#9a9a9a}
    .name{font-size:68px;font-weight:800;letter-spacing:-.02em;line-height:1;margin:14px 0 8px}.name:after{content:"";display:block;width:120px;height:5px;background:var(--a);margin-top:16px}
    .for{font-size:15px;color:#555;margin-top:22px}.course{font-size:27px;font-weight:700;margin-top:4px}
    .meta{display:flex;gap:46px;margin-top:auto;padding-top:30px;border-top:1px solid #ececec}.mk{font-size:10px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.1em}.mv{display:block;font-size:16px;margin-top:3px;font-weight:700}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px}.sig{min-width:240px}.sigimg{max-height:40px;display:block;margin-bottom:-2px}.sigline{border-top:1.6px solid #0e0f12;width:230px;margin-bottom:6px}.signame{font-weight:700;font-size:14px}.sigrole{font-size:11px;color:#9a9a9a}
  </style><div class="page"><div class="top">${d.logo ? logoImg(d) : `<div class="pv">${esc(d.provider)}</div>`}<div class="pv">${titleOf(d, "Certificate")}</div></div><div class="eyebrow">This certifies that</div><div class="name">${esc(d.name)}</div><div class="for">has successfully completed</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}<div style="text-align:right;font-size:11px;color:#9a9a9a">${esc(d.provider)}</div></div></div>` },

  // 7 — Gatsby · art deco linework
  { id: "deco", name: "Gatsby — Art Deco", desc: "Geometric deco lines, ink & accent, luxe", accent: "#c8a24a", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#101322;color:#eee7d3;font-family:${F_BODY};padding:22px}
    .frame{border:2px solid var(--a);min-height:658px;padding:46px 64px;text-align:center;position:relative;background:linear-gradient(#101322,#141830)}
    .frame:before,.frame:after{content:"";position:absolute;left:24px;right:24px;height:8px;border-left:2px solid var(--a);border-right:2px solid var(--a)}.frame:before{top:14px;border-top:2px solid var(--a)}.frame:after{bottom:14px;border-bottom:2px solid var(--a)}
    .logo{max-height:44px;margin:0 auto 6px;display:block}.provider{font-family:${F_LABEL};font-size:11px;letter-spacing:.36em;text-transform:uppercase;color:var(--a)}
    h1{font-family:${F_TITLE};font-weight:600;font-size:24px;letter-spacing:.28em;text-transform:uppercase;color:var(--a);margin:24px 0 0}
    .fan{color:var(--a);letter-spacing:.5em;margin:8px 0 4px;font-size:14px}
    .name{font-family:${F_SCRIPT};font-size:60px;color:#f6efd6;margin:2px 0}
    .rule{width:320px;height:1px;background:linear-gradient(90deg,transparent,var(--a),transparent);margin:6px auto 16px}
    .for{font-size:16px;color:#b6ad8e}.course{font-family:${F_TITLE};font-weight:600;font-size:21px;margin-top:4px;color:#f6efd6}
    .meta{display:flex;justify-content:center;gap:42px;margin-top:24px;font-family:${F_SANS}}.mk{font-size:9.5px;color:var(--a);text-transform:uppercase;letter-spacing:.16em}.mv{display:block;font-size:15px;margin-top:4px;color:#f6efd6}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px}.sig{text-align:center;min-width:210px;font-family:${F_SANS}}.sigimg{max-height:42px;display:block;margin:0 auto -2px;filter:brightness(0) invert(1)}.sigline{border-top:1px solid var(--a);width:200px;margin:0 auto 6px}.signame{font-weight:600;font-size:14px;color:#f6efd6}.sigrole{font-size:11px;color:var(--a)}
    .seal{width:84px;height:88px}
  </style><div class="page"><div class="frame">${logoImg(d)}<div class="provider">${esc(d.provider)}</div><h1>${titleOf(d, "Certificate of Distinction")}</h1><div class="fan">&#9670;&nbsp;&#9670;&nbsp;&#9670;</div><div class="name">${esc(d.name)}</div><div class="rule"></div><div class="for">is hereby recognised for completing</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}${seal(a)}</div></div></div>` },

  // 8 — Sunbeam · tasteful, warm, soft shapes
  { id: "playful", name: "Sunbeam — Warm", desc: "Soft rounded frame, friendly yet smart", accent: "#e08a2b", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fff;color:#26303f;font-family:${F_SANS};position:relative;overflow:hidden;border-radius:22px;padding:48px 60px;text-align:center;box-shadow:inset 0 0 0 10px ${soft(a, 12)}}
    .blob{position:absolute;border-radius:50%;z-index:0}.b1{width:200px;height:200px;background:${soft(a, 22)};top:-70px;left:-60px}.b2{width:150px;height:150px;background:${soft(a, 16)};bottom:-50px;right:-40px}.b3{width:80px;height:80px;background:${soft(a, 30)};top:26px;right:60px}
    .in{position:relative;z-index:1}
    .logo{max-height:48px;margin:0 auto 4px;display:block}.provider{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#7a869c;font-weight:700}
    h1{font-family:${F_TITLE};font-weight:600;font-size:24px;letter-spacing:.16em;text-transform:uppercase;color:var(--a);margin:18px 0 0}
    .pres{font-size:15px;color:#7a869c;margin-top:14px}.name{font-family:${F_SCRIPT};font-size:60px;color:#26303f;margin:0}
    .for{font-size:15px;color:#7a869c}.course{font-size:23px;font-weight:800;margin-top:2px}
    .meta{display:flex;justify-content:center;gap:26px;margin-top:22px}.mcell{background:${soft(a, 10)};border-radius:14px;padding:9px 18px}.mk{font-size:10px;color:#7a869c;text-transform:uppercase;letter-spacing:.06em}.mv{display:block;font-size:15px;margin-top:2px;color:#26303f}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px}.sig{text-align:center;min-width:210px}.sigimg{max-height:42px;display:block;margin:0 auto -2px}.sigline{border-top:2px dotted #9aa6bc;width:200px;margin:0 auto 6px}.signame{font-weight:800;font-size:14px}.sigrole{font-size:11px;color:#7a869c}
  </style><div class="page"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><div class="in">${logoImg(d)}<div class="provider">${esc(d.provider)}</div><h1>${titleOf(d, "Certificate of Achievement")}</h1><div class="pres">This is awarded to</div><div class="name">${esc(d.name)}</div><div class="for">for brilliantly completing</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}<div class="sig"><div class="sigline"></div><div class="signame">${esc(d.date)}</div><div class="sigrole">Awarded on</div></div></div></div></div>` },

  // 9 — Verdant · fresh, formal, subtle emblem
  { id: "health", name: "Verdant — Fresh", desc: "Clean band + emblem — ideal for compliance", accent: "#1f9d57", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#fff;color:#122b1e;font-family:${F_SANS};border:1px solid ${soft(a, 40)};overflow:hidden}
    .top{background:linear-gradient(135deg,${dark(a, 78)},var(--a));color:#fff;padding:30px 54px;display:flex;align-items:center;gap:16px;position:relative}
    .badge{width:44px;height:44px;border-radius:12px;background:#fff;display:grid;place-items:center;flex:none;font-size:22px;color:var(--a);font-weight:800;font-family:${F_TITLE}}
    .top .logo{max-height:38px;filter:brightness(0) invert(1)}.top h1{font-family:${F_TITLE};font-weight:600;font-size:22px;letter-spacing:.16em;text-transform:uppercase;margin:0}.top .pv{margin-left:auto;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.9;text-align:right}
    .body{padding:44px 56px 40px;text-align:center}
    .pres{font-size:16px;color:#4b6a58}.name{font-family:${F_SCRIPT};font-size:56px;color:var(--a);margin:2px 0 2px}
    .nb{width:120px;height:3px;background:var(--a);border-radius:2px;margin:0 auto 18px}
    .for{font-size:16px;color:#4b6a58}.course{font-family:${F_TITLE};font-weight:600;font-size:22px;margin-top:2px;color:#122b1e}
    .meta{display:flex;justify-content:center;gap:38px;margin-top:24px}.mk{font-size:10px;color:${dark(a, 55)};text-transform:uppercase;letter-spacing:.08em}.mv{display:block;font-size:15px;margin-top:3px}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px}.sig{text-align:center;min-width:210px}.sigimg{max-height:42px;display:block;margin:0 auto -2px}.sigline{border-top:1.4px solid #122b1e;width:200px;margin:0 auto 6px}.signame{font-weight:700;font-size:14px}.sigrole{font-size:11px;color:${dark(a, 55)}}
    .seal{width:84px;height:88px}
  </style><div class="page"><div class="top"><span class="badge">✓</span>${d.logo ? logoImg(d) : ""}<h1>${titleOf(d, "Certificate of Completion")}</h1><div class="pv">${esc(d.provider)}</div></div><div class="body"><div class="pres">This certifies that</div><div class="name">${esc(d.name)}</div><div class="nb"></div><div class="for">has successfully completed the training</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}${seal(a)}</div></div></div>` },

  // 10 — Regalia · charcoal + gold prestige
  { id: "prestige", name: "Regalia — Prestige", desc: "Charcoal & gold, laurel, premium dark", accent: "#c9a24a", render: (d, a) => `<style>
    .page{--a:${a};width:1000px;min-height:706px;margin:0 auto;background:#191c24;color:#efe9db;font-family:${F_BODY};padding:24px}
    .frame{border:1px solid var(--a);outline:3px solid var(--a);outline-offset:-11px;min-height:648px;padding:48px 66px;text-align:center;position:relative;background:radial-gradient(circle at 50% 30%, ${dark(a, 82)}, #191c24 62%)}
    .logo{max-height:46px;margin:0 auto 6px;display:block;filter:brightness(0) invert(1)}.provider{font-family:${F_LABEL};font-size:11px;letter-spacing:.36em;text-transform:uppercase;color:var(--a)}
    .laurel{width:150px;height:110px;margin:8px auto -4px;display:block}
    h1{font-family:${F_TITLE};font-weight:600;font-size:24px;letter-spacing:.24em;text-transform:uppercase;color:var(--a);margin:0}
    .name{font-family:${F_SCRIPT};font-size:60px;color:#fff;margin:6px 0 2px}
    .rule{width:320px;height:1px;background:linear-gradient(90deg,transparent,var(--a),transparent);margin:6px auto 16px}
    .for{font-size:16px;color:#c3bca8}.course{font-family:${F_TITLE};font-weight:600;font-size:21px;margin-top:4px;color:#fff}
    .meta{display:flex;justify-content:center;gap:44px;margin-top:24px;font-family:${F_SANS}}.mk{font-size:9.5px;color:var(--a);text-transform:uppercase;letter-spacing:.16em}.mv{display:block;font-size:15px;margin-top:4px;color:#fff}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px}.sig{text-align:center;min-width:210px;font-family:${F_SANS}}.sigimg{max-height:42px;display:block;margin:0 auto -2px;filter:brightness(0) invert(1)}.sigline{border-top:1px solid #efe9db;width:200px;margin:0 auto 6px}.signame{font-weight:600;font-size:14px;color:#fff}.sigrole{font-size:11px;color:var(--a)}
  </style><div class="page"><div class="frame">${logoImg(d)}<div class="provider">${esc(d.provider)}</div>${laurel(a)}<h1>${titleOf(d, "Certificate of Achievement")}</h1><div class="name">${esc(d.name)}</div><div class="rule"></div><div class="for">is hereby awarded this certificate for completing</div><div class="course">${esc(d.course)}</div>${metaRow(d)}<div class="foot">${qrFoot(d)}${sig(d)}<div class="sig"><div class="sigline"></div><div class="signame">${esc(d.date)}</div><div class="sigrole">Date of completion</div></div></div></div></div>` },
];

export const certTemplateOf = (id?: string): CertTemplate => CERT_TEMPLATES.find((t) => t.id === id) ?? CERT_TEMPLATES[0];
// curated accent palette for the provider to recolour any template
export const CERT_ACCENTS: [string, string][] = [
  ["Gold", "#a9832f"], ["Navy", "#1c2f6b"], ["Royal blue", "#2352c9"], ["Emerald", "#1f9d57"], ["Teal", "#0f766e"],
  ["Burgundy", "#8a1f3d"], ["Plum", "#6d28d9"], ["Charcoal", "#334155"], ["Bronze", "#9a6a2f"], ["Rose", "#c1466f"],
];

export function certificateDoc(d: CertData, templateId?: string, print = true): string {
  const tpl = certTemplateOf(templateId);
  const inner = tpl.render(d, d.accent || tpl.accent);
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Great+Vibes&family=Josefin+Sans:wght@400;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Certificate — ${esc(d.course)}</title>${fonts}<style>*{margin:0;box-sizing:border-box}html,body{background:#eef1f6}body{padding:18px}@media print{body{background:#fff;padding:0}}@page{size:landscape;margin:8mm}</style></head><body>${inner}${print ? `<script>window.onload=function(){setTimeout(function(){window.print()},450)}</script>` : ""}</body></html>`;
}

export function openCertificate(d: CertData, templateId?: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (w) { w.document.write(certificateDoc(d, templateId)); w.document.close(); }
}

export const CERT_SAMPLE: CertData = {
  name: "Jordan Taylor", course: "Safeguarding Children (Level 2)", pct: 92,
  date: "14 August 2026", expiry: "14 August 2027", provider: "Your Company Name",
  ref: "AOS-7K2P9QX4", signName: "Alex Morgan", signRole: "Training Manager",
};
