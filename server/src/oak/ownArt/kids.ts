// Our own cast of six children (front-facing, flat, no outlines) — full length for the "line for the door" slides, head-and-shoulders for the
// speech bubbles. One drawing routine, so a child looks the same everywhere. Frame heights are always 1280 (the original picture height).
import { P, dark, light, mix, shadow, svg } from "./kit";

export interface Kid {
  key: string; W: number; skin: string; hair: string; jumper: string; accent: string;
  style: "plaits" | "bun" | "puffs" | "short" | "hijab" | "curly";
  bottom: "trousers" | "skirt" | "shorts"; bcol: string; glasses?: boolean; hijab?: string;
}
const HAIR = "#2b1d2f";
export const KIDS: Record<string, Kid> = {
  laura: { key: "laura", W: 434, skin: "#f3c9a5", hair: "#8a4a2b", jumper: P.violet, accent: P.gold, style: "plaits", bottom: "trousers", bcol: "#34406b" },
  andeep: { key: "andeep", W: 307, skin: "#c98b5e", hair: HAIR, jumper: P.teal, accent: P.yellow, style: "bun", bottom: "trousers", bcol: "#34406b" },
  izzy: { key: "izzy", W: 436, skin: "#7a4a30", hair: "#1e1521", jumper: P.gold, accent: P.brand2, style: "puffs", bottom: "skirt", bcol: P.brand },
  sam: { key: "sam", W: 430, skin: "#e8b58c", hair: "#b0602a", jumper: P.green, accent: P.white, style: "short", bottom: "trousers", bcol: "#34406b" },
  aisha: { key: "aisha", W: 336, skin: "#b9784f", hair: HAIR, jumper: P.brand2, accent: P.pink, style: "hijab", bottom: "skirt", bcol: "#34406b", hijab: "#ff8fa8" },
  alex: { key: "alex", W: 343, skin: "#f3c9a5", hair: "#3a2a22", jumper: "#e8505b", accent: P.white, style: "curly", bottom: "shorts", bcol: "#34406b", glasses: true },
};

const f = (v: number) => +v.toFixed(1);

function ring(cx: number, cy: number, rad: number, from: number, to: number, count: number, r: number, fill: string): string {
  let s = "";
  for (let i = 0; i < count; i++) {
    const a = ((from + ((to - from) * i) / Math.max(1, count - 1)) * Math.PI) / 180;
    s += `<circle cx="${f(cx + rad * Math.cos(a))}" cy="${f(cy + rad * Math.sin(a))}" r="${f(r)}" fill="${fill}"/>`;
  }
  return s;
}

/** the head: hair behind, face, hair in front. (cx, cy) = centre of the face, R = its radius. `links` = braid length for plaits. */
export function head(k: Kid, cx: number, cy: number, R: number, links = 5): string {
  const eyeY = cy + R * 0.06, ex = R * 0.36;
  const skinD = dark(k.skin, 0.12);
  let back = "", front = "";
  let faceR = R;
  const capPath = (top: number) => `M${f(cx - R * 1.06)} ${f(cy + R * 0.1)} C${f(cx - R * 1.12)} ${f(cy - R * top)} ${f(cx + R * 1.12)} ${f(cy - R * top)} ${f(cx + R * 1.06)} ${f(cy + R * 0.1)} C${f(cx + R * 0.8)} ${f(cy - R * 0.62)} ${f(cx + R * 0.15)} ${f(cy - R * 0.42)} ${f(cx - R * 0.2)} ${f(cy - R * 0.55)} C${f(cx - R * 0.6)} ${f(cy - R * 0.5)} ${f(cx - R * 0.92)} ${f(cy - R * 0.2)} ${f(cx - R * 1.06)} ${f(cy + R * 0.1)} Z`;
  switch (k.style) {
    case "plaits": {
      back = `<ellipse cx="${cx}" cy="${f(cy - R * 0.04)}" rx="${f(R * 1.08)}" ry="${f(R * 1.06)}" fill="${k.hair}"/>`;
      front = `<path d="${capPath(1.32)}" fill="${k.hair}"/>`;
      for (const s of [-1, 1]) {
        let b = "";
        const x0 = cx + s * R * 1.0, y0 = cy + R * 0.62, step = R * 0.42;
        for (let i = 0; i < links; i++) b += `<ellipse cx="${f(x0 + s * (i % 2 ? 3 : -2) * (R / 100))}" cy="${f(y0 + i * step)}" rx="${f(R * 0.21)}" ry="${f(R * 0.27)}" fill="${i % 2 ? dark(k.hair, 0.12) : k.hair}"/>`;
        b += `<circle cx="${f(x0)}" cy="${f(y0 + (links - 1) * step + R * 0.3)}" r="${f(R * 0.16)}" fill="${k.accent}"/>`;
        front += b;
      }
      break;
    }
    case "bun":
      back = `<circle cx="${cx}" cy="${f(cy - R * 1.02)}" r="${f(R * 0.36)}" fill="${k.hair}"/>`;
      front = `<path d="${capPath(1.28)}" fill="${k.hair}"/><rect x="${f(cx - R * 0.34)}" y="${f(cy - R * 0.83)}" width="${f(R * 0.68)}" height="${f(R * 0.12)}" rx="${f(R * 0.06)}" fill="${k.accent}"/>`;
      break;
    case "puffs": {
      const puff = (s: number) => { const px = cx + s * R * 0.92, py = cy - R * 0.78; return `<circle cx="${f(px)}" cy="${f(py)}" r="${f(R * 0.4)}" fill="${k.hair}"/>` + ring(px, py, R * 0.36, 0, 360, 9, R * 0.16, k.hair) + `<circle cx="${f(cx + s * R * 0.72)}" cy="${f(cy - R * 0.5)}" r="${f(R * 0.13)}" fill="${k.accent}"/>`; };
      back = puff(-1) + puff(1);
      front = `<path d="${capPath(1.22)}" fill="${k.hair}"/>` + ring(cx, cy - R * 0.16, R * 0.96, 200, 340, 8, R * 0.15, k.hair);
      break;
    }
    case "short":
      front = `<path d="M${f(cx - R * 1.06)} ${f(cy + R * 0.02)} C${f(cx - R * 1.16)} ${f(cy - R * 1.3)} ${f(cx + R * 1.16)} ${f(cy - R * 1.3)} ${f(cx + R * 1.06)} ${f(cy + R * 0.02)} C${f(cx + R * 0.96)} ${f(cy - R * 0.5)} ${f(cx + R * 0.5)} ${f(cy - R * 0.72)} ${f(cx - R * 0.1)} ${f(cy - R * 0.7)} C${f(cx - R * 0.6)} ${f(cy - R * 0.52)} ${f(cx - R * 0.98)} ${f(cy - R * 0.3)} ${f(cx - R * 1.06)} ${f(cy + R * 0.02)} Z" fill="${k.hair}"/><path d="M${f(cx - R * 0.2)} ${f(cy - R * 1.06)} C${f(cx + R * 0.2)} ${f(cy - R * 1.36)} ${f(cx + R * 0.7)} ${f(cy - R * 1.26)} ${f(cx + R * 0.62)} ${f(cy - R * 0.96)} C${f(cx + R * 0.4)} ${f(cy - R * 1.02)} ${f(cx + R * 0.1)} ${f(cy - R * 1.0)} ${f(cx - R * 0.2)} ${f(cy - R * 1.06)} Z" fill="${k.hair}"/>`;
      break;
    case "curly":
      back = ring(cx, cy - R * 0.1, R * 1.02, 170, 370, 13, R * 0.24, k.hair);
      front = `<path d="${capPath(1.18)}" fill="${k.hair}"/>` + ring(cx, cy - R * 0.2, R * 0.86, 200, 340, 8, R * 0.2, k.hair);
      break;
    case "hijab":
      faceR = R * 0.92;
      back = `<path d="M${f(cx - R * 1.2)} ${f(cy + R * 0.5)} C${f(cx - R * 1.4)} ${f(cy + R * 1.3)} ${f(cx - R * 0.6)} ${f(cy + R * 1.85)} ${cx} ${f(cy + R * 1.85)} C${f(cx + R * 0.6)} ${f(cy + R * 1.85)} ${f(cx + R * 1.4)} ${f(cy + R * 1.3)} ${f(cx + R * 1.2)} ${f(cy + R * 0.5)} Z" fill="${dark(k.hijab!, 0.1)}"/><ellipse cx="${cx}" cy="${f(cy - R * 0.02)}" rx="${f(R * 1.22)}" ry="${f(R * 1.24)}" fill="${k.hijab}"/>`;
      front = `<path d="M${f(cx - R * 0.98)} ${f(cy - R * 0.2)} C${f(cx - R * 0.7)} ${f(cy - R * 1.0)} ${f(cx + R * 0.7)} ${f(cy - R * 1.0)} ${f(cx + R * 0.98)} ${f(cy - R * 0.2)} C${f(cx + R * 0.7)} ${f(cy - R * 0.58)} ${f(cx - R * 0.7)} ${f(cy - R * 0.58)} ${f(cx - R * 0.98)} ${f(cy - R * 0.2)} Z" fill="${light(k.hijab!, 0.18)}"/>`;
      break;
  }
  const ears = k.style === "hijab" ? "" : `<circle cx="${f(cx - R * 0.99)}" cy="${f(cy + R * 0.16)}" r="${f(R * 0.15)}" fill="${skinD}"/><circle cx="${f(cx + R * 0.99)}" cy="${f(cy + R * 0.16)}" r="${f(R * 0.15)}" fill="${skinD}"/>`;
  const face = `<circle cx="${cx}" cy="${cy}" r="${f(faceR)}" fill="${k.skin}"/>` +
    `<circle cx="${f(cx - ex)}" cy="${f(eyeY)}" r="${f(R * 0.085)}" fill="${P.ink}"/><circle cx="${f(cx + ex)}" cy="${f(eyeY)}" r="${f(R * 0.085)}" fill="${P.ink}"/>` +
    `<circle cx="${f(cx - ex + R * 0.03)}" cy="${f(eyeY - R * 0.03)}" r="${f(R * 0.03)}" fill="#fff"/><circle cx="${f(cx + ex + R * 0.03)}" cy="${f(eyeY - R * 0.03)}" r="${f(R * 0.03)}" fill="#fff"/>` +
    `<circle cx="${f(cx - R * 0.56)}" cy="${f(cy + R * 0.34)}" r="${f(R * 0.14)}" fill="${P.pink}" opacity="0.5"/><circle cx="${f(cx + R * 0.56)}" cy="${f(cy + R * 0.34)}" r="${f(R * 0.14)}" fill="${P.pink}" opacity="0.5"/>` +
    `<path d="M${f(cx - R * 0.26)} ${f(cy + R * 0.42)} Q${cx} ${f(cy + R * 0.7)} ${f(cx + R * 0.26)} ${f(cy + R * 0.42)}" fill="none" stroke="${dark(k.skin, 0.55)}" stroke-width="${f(R * 0.06)}" stroke-linecap="round"/>` +
    (k.glasses ? `<g fill="#fff" fill-opacity="0.25" stroke="${P.ink}" stroke-width="${f(R * 0.06)}"><circle cx="${f(cx - ex)}" cy="${f(eyeY)}" r="${f(R * 0.25)}"/><circle cx="${f(cx + ex)}" cy="${f(eyeY)}" r="${f(R * 0.25)}"/><path d="M${f(cx - ex + R * 0.25)} ${f(eyeY)} H${f(cx + ex - R * 0.25)}" fill="none"/></g>` : "");
  return back + ears + face + front;
}

/** full-length child, frame k.W x 1280 */
export function kidFull(k: Kid): string {
  const W = k.W, cx = W / 2, R = Math.min(108, W * 0.34), hy = 170;
  const tw = Math.min(300, W * 0.62), aw = Math.min(58, W * 0.13), lw = tw * 0.4, gap = tw * 0.06;
  const jd = dark(k.jumper, 0.16), jl = light(k.jumper, 0.28);
  const sh = shadow("ks", cx, 1266, W * 0.42, 12, 0.22);
  let legs = "";
  const lx = [cx - gap / 2 - lw, cx + gap / 2];
  if (k.bottom === "trousers") {
    for (const x of lx) legs += `<rect x="${f(x)}" y="640" width="${f(lw)}" height="580" rx="${f(lw * 0.3)}" fill="${k.bcol}"/><rect x="${f(x)}" y="640" width="${f(lw * 0.22)}" height="580" rx="6" fill="${light(k.bcol, 0.1)}"/>`;
  } else {
    const y1 = k.bottom === "skirt" ? 900 : 860;
    for (const x of lx) legs += `<rect x="${f(x + lw * 0.1)}" y="${y1 - 40}" width="${f(lw * 0.8)}" height="${1150 - y1 + 40}" rx="${f(lw * 0.3)}" fill="${k.skin}"/><rect x="${f(x + lw * 0.06)}" y="1130" width="${f(lw * 0.88)}" height="92" rx="20" fill="#fff"/><rect x="${f(x + lw * 0.06)}" y="1130" width="${f(lw * 0.88)}" height="22" rx="8" fill="${k.accent === "#ffffff" ? P.brand2 : k.accent}"/>`;
    if (k.bottom === "skirt") {
      const tw2 = tw * 1.26, top = tw * 0.98;
      legs += `<path d="M${f(cx - top / 2)} 660 L${f(cx + top / 2)} 660 L${f(cx + tw2 / 2)} 930 Q${cx} 960 ${f(cx - tw2 / 2)} 930 Z" fill="${k.bcol}"/>`;
      for (const s of [-0.42, -0.14, 0.14, 0.42]) legs += `<path d="M${f(cx + s * top)} 670 L${f(cx + s * tw2 * 1.05)} 940" stroke="${dark(k.bcol, 0.3)}" stroke-width="5" opacity="0.5"/>`;
    } else {
      const tw2 = tw * 1.02;
      legs += `<path d="M${f(cx - tw2 / 2)} 660 L${f(cx + tw2 / 2)} 660 L${f(cx + tw2 / 2 + 8)} 880 L${f(cx + 4)} 880 L${f(cx)} 800 L${f(cx - 4)} 880 L${f(cx - tw2 / 2 - 8)} 880 Z" fill="${k.bcol}"/>`;
    }
  }
  const shoes = lx.map((x) => `<rect x="${f(x - lw * 0.04)}" y="1208" width="${f(lw * 1.08)}" height="58" rx="26" fill="${P.ink}"/><rect x="${f(x - lw * 0.04)}" y="1248" width="${f(lw * 1.08)}" height="18" rx="9" fill="#e8ebf5"/>`).join("");
  const arm = (s: number) => {
    const ax = cx + s * (tw / 2 + aw * 0.28) - aw / 2;
    return `<rect x="${f(ax)}" y="300" width="${f(aw)}" height="440" rx="${f(aw / 2)}" fill="${jd}"/><circle cx="${f(ax + aw / 2)}" cy="752" r="${f(aw * 0.58)}" fill="${k.skin}"/>`;
  };
  const torso = `<rect x="${f(cx - tw / 2)}" y="276" width="${f(tw)}" height="430" rx="60" fill="${k.jumper}"/><rect x="${f(cx - tw / 2)}" y="640" width="${f(tw)}" height="66" rx="24" fill="${jd}"/>` +
    `<rect x="${f(cx - tw / 2 + 14)}" y="470" width="${f(tw - 28)}" height="22" rx="11" fill="${k.accent === "#ffffff" ? jl : k.accent}" opacity="0.9"/><rect x="${f(cx - tw / 2 + 14)}" y="506" width="${f(tw - 28)}" height="12" rx="6" fill="${jl}" opacity="0.7"/>` +
    `<path d="M${f(cx - 40)} 276 L${cx} 344 L${f(cx + 40)} 276 Z" fill="#fff"/><path d="M${f(cx - 22)} 276 L${cx} 316 L${f(cx + 22)} 276 Z" fill="${k.skin}"/>`;
  const neck = `<rect x="${f(cx - 26)}" y="${hy + R * 0.75}" width="52" height="${f(300 - hy - R * 0.75)}" rx="10" fill="${dark(k.skin, 0.1)}"/>`;
  const hijabNeck = k.style === "hijab" ? "" : neck;
  const body = sh.body + legs + shoes + hijabNeck + arm(-1) + arm(1) + torso + head(k, cx, hy, R);
  return svg(W, 1280, body, W, 1280, sh.defs);
}

/** head and shoulders, frame W x H; (cx, cy, R) place the face, `links` = braid length */
export function kidHead(k: Kid, W: number, H: number, cx: number, cy: number, R: number, links = 5): string {
  const shY = cy + R * 1.18;
  const shoulders = `<path d="M${f(cx - R * 1.9)} ${H} C${f(cx - R * 1.9)} ${f(shY + R * 0.2)} ${f(cx - R * 1.0)} ${f(shY - R * 0.05)} ${cx} ${f(shY - R * 0.05)} C${f(cx + R * 1.0)} ${f(shY - R * 0.05)} ${f(cx + R * 1.9)} ${f(shY + R * 0.2)} ${f(cx + R * 1.9)} ${H} Z" fill="${k.jumper}"/><path d="M${f(cx - R * 0.5)} ${f(shY - R * 0.02)} L${cx} ${f(shY + R * 0.5)} L${f(cx + R * 0.5)} ${f(shY - R * 0.02)} Z" fill="#fff"/>`;
  const neck = k.style === "hijab" ? "" : `<rect x="${f(cx - R * 0.26)}" y="${f(cy + R * 0.7)}" width="${f(R * 0.52)}" height="${f(R * 0.6)}" fill="${dark(k.skin, 0.1)}"/>`;
  // braids / hijab drape hang in front of the shoulders, so draw head last
  return svg(W, H, (k.style === "hijab" ? "" : shoulders) + neck + (k.style === "hijab" ? shoulders : "") + head(k, cx, cy, R, links), W, H);
}
export { mix };
