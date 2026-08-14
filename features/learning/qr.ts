// Minimal, dependency-free QR encoder — byte mode, error-correction level M,
// versions 1–10 (enough for a verification URL). Returns an SVG string so it
// renders anywhere (print windows, iframes, offline) with no external service.
// Validated by round-trip decoding (jsQR) in the build script before shipping.

// GF(256) log/antilog tables (primitive poly 0x11d)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGen(deg: number): number[] {
  let poly = [1];
  for (let i = 0; i < deg; i++) { const np = new Array(poly.length + 1).fill(0); for (let j = 0; j < poly.length; j++) { np[j] ^= gmul(poly[j], 1); np[j + 1] ^= gmul(poly[j], EXP[i]); } poly = np; }
  return poly;
}
function rsEnc(data: number[], deg: number): number[] {
  const gen = rsGen(deg); const res = new Array(deg).fill(0);
  for (const d of data) { const factor = d ^ res[0]; res.shift(); res.push(0); if (factor !== 0) for (let i = 0; i < gen.length - 1; i++) res[i] ^= gmul(gen[i + 1], factor); }
  return res;
}

// level-M block structure per version 1..10: [ecPerBlock, [ [count, dataPerBlock], ... ] ]
const MBLOCKS: Record<number, [number, [number, number][]]> = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [24, [[4, 43], [1, 44]]],
};
const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const dataCap = (v: number) => MBLOCKS[v][1].reduce((s, [c, d]) => s + c * d, 0);

function bchFormat(fmt: number): number { let d = fmt << 10; for (let i = 4; i >= 0; i--) if (d & (1 << (i + 10))) d ^= 0x537 << i; return ((fmt << 10) | d) ^ 0x5412; }
function bchVersion(v: number): number { let d = v << 12; for (let i = 5; i >= 0; i--) if (d & (1 << (i + 12))) d ^= 0x1f25 << i; return (v << 12) | d; }

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1; while (ver <= 10 && bytes.length + 2 > dataCap(ver)) ver++;
  if (ver > 10) throw new Error("QR content too long");
  const size = 17 + ver * 4;
  const cap = dataCap(ver);

  // bit stream: mode(0100) + length + data
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < 4 && bits.length < cap * 8; i++) bits.push(0); // terminator
  while (bits.length % 8) bits.push(0);
  const dcw: number[] = []; for (let i = 0; i < bits.length; i += 8) dcw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  const pads = [0xec, 0x11]; let p = 0; while (dcw.length < cap) dcw.push(pads[p++ % 2]);

  // split into blocks, compute EC, interleave
  const [ecLen, groups] = MBLOCKS[ver];
  const dataBlocks: number[][] = []; const ecBlocks: number[][] = []; let idx = 0;
  for (const [count, per] of groups) for (let c = 0; c < count; c++) { const blk = dcw.slice(idx, idx + per); idx += per; dataBlocks.push(blk); ecBlocks.push(rsEnc(blk, ecLen)); }
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  const out: number[] = [];
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const b of ecBlocks) out.push(b[i]);
  const finalBits: number[] = []; for (const b of out) for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1);

  // matrix + reserved map
  const m: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const res: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (r: number, c: number, v: boolean) => { m[r][c] = v; res[r][c] = true; };
  const finder = (r: number, c: number) => { for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue; const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6; const on = inRing && ((dr === 0 || dr === 6 || dc === 0 || dc === 6) || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)); setF(rr, cc, on); } };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { const v = i % 2 === 0; setF(6, i, v); setF(i, 6, v); } // timing
  const ap = ALIGN[ver]; for (const r of ap) for (const c of ap) { if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) setF(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1); }
  setF(size - 8, 8, true); // dark module
  // reserve format areas
  for (let i = 0; i < 9; i++) { if (!res[8][i]) res[8][i] = true; if (!res[i][8] && i !== 6) res[i][8] = true; }
  for (let i = 0; i < 8; i++) { res[8][size - 1 - i] = true; res[size - 1 - i][8] = true; }
  if (ver >= 7) { for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { res[i][size - 11 + j] = true; res[size - 11 + j][i] = true; } }

  // place data with zigzag
  let bi = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < size; k++) { const row = up ? size - 1 - k : k; for (let c = 0; c < 2; c++) { const cc = col - c; if (res[row][cc]) continue; m[row][cc] = bi < finalBits.length ? finalBits[bi] === 1 : false; bi++; } }
    up = !up;
  }

  // masks + penalty; pick best
  const maskFn = [(r: number, c: number) => (r + c) % 2 === 0, (r: number, _c: number) => r % 2 === 0, (_r: number, c: number) => c % 3 === 0, (r: number, c: number) => (r + c) % 3 === 0, (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0, (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  const applyFmt = (grid: boolean[][], mask: number) => {
    const f = bchFormat((0b00 << 3) | mask);
    const bit = (i: number) => ((f >> i) & 1) === 1;
    // copy 1 — the L-shape around the top-left finder
    for (let i = 0; i <= 5; i++) grid[i][8] = bit(i);
    grid[7][8] = bit(6); grid[8][8] = bit(7); grid[8][7] = bit(8);
    for (let i = 9; i < 15; i++) grid[8][14 - i] = bit(i);
    // copy 2 — under top-right finder (row 8) and right of bottom-left finder (col 8)
    for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = bit(i);
    if (ver >= 7) { const vinfo = bchVersion(ver); for (let i = 0; i < 18; i++) { const b = ((vinfo >> i) & 1) === 1; const a = size - 11 + (i % 3), bb = Math.floor(i / 3); grid[bb][a] = b; grid[a][bb] = b; } }
  };
  const penalty = (g: boolean[][]) => {
    let pen = 0;
    for (let r = 0; r < size; r++) { let run = 1; for (let c = 1; c < size; c++) { if (g[r][c] === g[r][c - 1]) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; } else run = 1; } }
    for (let c = 0; c < size; c++) { let run = 1; for (let r = 1; r < size; r++) { if (g[r][c] === g[r - 1][c]) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; } else run = 1; } }
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) pen += 3;
    let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (g[r][c]) dark++;
    pen += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return pen;
  };

  let best: boolean[][] | null = null, bestPen = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g: boolean[][] = m.map((row) => row.map((v) => v === true));
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!res[r][c] && maskFn[mask](r, c)) g[r][c] = !g[r][c];
    applyFmt(g, mask);
    const pen = penalty(g);
    if (pen < bestPen) { bestPen = pen; best = g; }
  }
  return best!;
}

export function qrSvg(text: string, px = 120): string {
  const mat = qrMatrix(text);
  const n = mat.length, quiet = 2, dim = n + quiet * 2;
  let rects = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
  return `<svg class="qr" width="${px}" height="${px}" viewBox="0 0 ${dim} ${dim}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}
