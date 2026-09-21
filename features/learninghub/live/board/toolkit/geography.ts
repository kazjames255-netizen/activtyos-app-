import { PASTEL, list, num, type B, type ToolItem } from "./kit";
import { MAP_REGIONS } from "../render-stamps";

const compass = (b: B, c: { ink: string; danger: string }, r = 120) => {
  b.ellipse(0, 0, r, r, { w: 3, c: c.ink });
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, l = i % 2 ? r * 0.62 : r * 0.95, d = i % 2 ? r * 0.16 : r * 0.24; const x = Math.cos(a) * l, y = Math.sin(a) * l, px = -Math.sin(a) * d, py = Math.cos(a) * d; b.polygon([[0, 0], [x * 0.5 + px, y * 0.5 + py], [x, y], [x * 0.5 - px, y * 0.5 - py]], { w: 2.5, c: i % 2 ? c.ink : c.danger }); }
  b.tc(0, -r - 24, "N", { size: 30, bold: true, c: c.danger }); b.tc(0, r + 24, "S", { size: 26, bold: true }); b.tc(r + 24, 0, "E", { size: 26, bold: true }); b.tc(-r - 24, 0, "W", { size: 26, bold: true });
};

export const GEOGRAPHY: ToolItem[] = [
  { id: "geo-map", pack: "geography", label: "Outline map", sub: "world · continents · UK & Ireland — label and draw on it", params: [{ k: "region", label: "Region", type: "select", def: "World", options: Object.values(MAP_REGIONS).map((r) => r.label) }, { k: "labels", label: "Names on the map", type: "select", def: "Yes", options: ["Yes", "No"] }, { k: "grid", label: "Letter–number grid", type: "select", def: "No", options: ["No", "Yes"] }],
    make: (b, c, v) => { const key = Object.keys(MAP_REGIONS).find((k) => MAP_REGIONS[k]!.label === v.region) ?? "world", r = MAP_REGIONS[key]!; b.stamp("map", 0, 0, r.size[0], r.size[1], { region: key, grid: v.grid === "Yes", labels: v.labels !== "No" }); void c; } },
  { id: "geo-own", pack: "geography", label: "Your own map (picture)", sub: "add any map image — overlay a grid on top", action: "picture" },
  { id: "geo-compass", pack: "geography", label: "Compass rose", levels: ["early", "standard", "advanced"], make: (b, c) => compass(b, c) },
  { id: "geo-grid4", pack: "geography", label: "4-figure grid reference overlay", sub: "numbered grid lines 00–09", levels: ["standard", "advanced"], make: (b, c) => { const n = 10, s = 56; b.rect(0, 0, n * s, n * s, { w: 3, c: c.brand }); for (let i = 1; i < n; i++) { b.line(i * s, 0, i * s, n * s, { w: 1.8, c: c.brand }); b.line(0, i * s, n * s, i * s, { w: 1.8, c: c.brand }); } for (let i = 0; i <= n; i++) { b.tc(i * s, -16, String(i).padStart(2, "0"), { size: 15, bold: true, c: c.brand }); b.tc(-20, (n - i) * s, String(i).padStart(2, "0"), { size: 15, bold: true, c: c.brand }); } b.tc((n * s) / 2, n * s + 26, "Eastings → then Northings ↑   (along the corridor, then up the stairs)", { size: 16 }); } },
  { id: "geo-grid6", pack: "geography", label: "6-figure grid reference square", sub: "one square divided in tenths", levels: ["standard", "advanced"], make: (b, c) => { const s = 560; b.rect(0, 0, s, s, { w: 3.5, c: c.brand }); for (let i = 1; i < 10; i++) { b.line((i * s) / 10, 0, (i * s) / 10, s, { w: 1.2, c: "#7d8aa3" }); b.line(0, (i * s) / 10, s, (i * s) / 10, { w: 1.2, c: "#7d8aa3" }); } for (let i = 0; i <= 10; i += 2) { b.tc((i * s) / 10, -14, String(i), { size: 15, bold: true }); b.tc(-16, s - (i * s) / 10, String(i), { size: 15, bold: true }); } b.tc(s / 2, s + 26, "Tenths of a square: eastings, then northings", { size: 16 }); } },
  { id: "geo-contour", pack: "geography", label: "Contour lines practice", levels: ["standard", "advanced"], make: (b, c) => { const heights = [100, 200, 300, 400]; heights.forEach((h, i) => { const rx = 320 - i * 70, ry = 200 - i * 45; const pts: [number, number][] = []; for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2, wob = 1 + 0.12 * Math.sin(a * 3 + i); pts.push([Math.cos(a) * rx * wob + i * 12, Math.sin(a) * ry * wob - i * 6]); } b.path(pts, { w: 3, c: "#a86a3a" }); b.text(rx * 0.95 + i * 12 - 30, -i * 6 - 12, String(h), { size: 15, c: "#a86a3a", bold: true }); }); b.tc(60, 15, "▲ 412 m", { size: 15, bold: true }); void c; } },
  { id: "geo-climate", pack: "geography", label: "Climate graph frame", sub: "rainfall bars + temperature line, two axes", levels: ["standard", "advanced"], make: (b, c) => { const W = 600, H = 320; b.arrow(0, H, 0, -20, { w: 3 }); b.arrow(W, H, W, -20, { w: 3 }); b.line(0, H, W, H, { w: 3 }); "JFMAMJJASOND".split("").forEach((m, i) => b.tc(25 + i * 50, H + 20, m, { size: 18, bold: true })); for (let i = 0; i <= 8; i++) { b.line(-6, H - i * 40, 6, H - i * 40, { w: 2 }); b.text(-58, H - i * 40 - 10, String(i * 25), { size: 14, c: c.brand }); b.text(W + 14, H - i * 40 - 10, String(i * 5 - 10), { size: 14, c: c.danger }); } b.tc(-30, -40, "Rainfall (mm)", { size: 17, bold: true, c: c.brand }); b.tc(W + 20, -40, "Temp (°C)", { size: 17, bold: true, c: c.danger }); b.tc(W / 2, H + 56, "Month", { size: 17, bold: true }); } },
  { id: "geo-longprofile", pack: "geography", label: "River long profile", levels: ["standard", "advanced"], make: (b, c) => { b.arrow(0, 300, 0, -10, { w: 3 }); b.arrow(0, 300, 620, 300, { w: 3 }); const p: [number, number][] = []; for (let x = 0; x <= 1; x += 0.02) p.push([20 + x * 570, 290 - 270 * Math.pow(1 - x, 2.4) - 10 * x]); b.path(p, { w: 5, c: c.brand }); b.tc(300, 340, "Distance from source", { size: 18, bold: true }); b.tc(-40, -30, "Height", { size: 18, bold: true }); b.tc(70, 40, "Upper course", { size: 17, bold: true, c: c.danger }); b.tc(300, 200, "Middle", { size: 17, bold: true, c: c.danger }); b.tc(510, 250, "Lower course", { size: 17, bold: true, c: c.danger }); } },
  { id: "geo-valley", pack: "geography", label: "River cross-section (V-shaped valley)", levels: ["standard", "advanced"], make: (b, c) => { b.path([[-320, -120], [-40, 90], [0, 100], [40, 90], [320, -120]], { w: 5, c: "#7a5a3a" }); b.path([[-30, 96], [0, 104], [30, 96]], { w: 5, c: c.brand }); b.line(-320, -120, 320, -120, { w: 2, c: "#7d8aa3" }); b.tc(0, 140, "channel", { size: 18, bold: true }); b.tc(-200, -140, "interlocking spurs / valley sides", { size: 17 }); } },
  { id: "geo-water", pack: "geography", label: "Water cycle frame", sub: "sun, sea, hill and cloud with the four processes as typeable boxes", levels: ["early", "standard"], params: [{ k: "boxes", label: "The four label boxes", type: "select", def: "Show the words", options: ["Show the words", "Leave blank for students to write"] }],
    make: (b, c, v) => {
      b.ellipse(-300, -170, 55, 55, { c: "#f5b81f", w: 4, fill: "#fff3b0" }); b.path([[-450, 150], [-200, 150]], { w: 3 }); b.rect(-450, 150, 900, 70, { c: c.brand, w: 3, fill: "#dbeafe" }); b.path([[-100, 60], [80, -60], [200, -100], [320, 150]], { w: 4, c: "#7a5a3a" }); b.ellipse(120, -180, 110, 55, { c: c.ink, w: 3.5, fill: "#f1f5f9" });
      b.arrow(-330, 130, -330, -30, { c: c.danger, w: 4 }); b.arrow(-230, -30, 30, -150, { c: c.danger, w: 4 }); b.arrow(150, -120, 250, 40, { c: c.brand, w: 4 }); b.arrow(260, 80, 30, 150, { c: c.brand, w: 4 });
      const show = v.boxes === "Show the words";
      // one typeable box per process, each beside its own arrow (the words are pre-filled or left for students)
      ([[-315, 30, "Evaporation"], [15, -305, "Condensation"], [265, -75, "Precipitation"], [-120, 232, "Run-off / collection"]] as [number, number, string][]).forEach(([x, y, t]) => b.cell(x, y, 210, 46, { c: c.ink, w: 2, dash: !show, text: show ? t : undefined, ph: "Write the process…", size: 22, bold: true, fill: show ? "#ffffff" : null }));
    } },
  { id: "geo-rock", pack: "geography", label: "Rock cycle frame", sub: "three rock types + typeable boxes for the processes", levels: ["standard", "advanced"], make: (b, c) => { [[0, -170, "Igneous"], [-260, 100, "Sedimentary"], [260, 100, "Metamorphic"]].forEach(([x, y, t], i) => { b.cell((x as number) - 110, (y as number) - 52, 220, 104, { shape: "ellipse", c: c.brand, w: 3.5, fill: PASTEL[i], text: String(t), size: 26, bold: true }); }); b.arrow(-60, -125, -220, 55, { w: 3.5 }); b.arrow(-150, 130, 150, 130, { w: 3.5 }); b.arrow(220, 55, 60, -125, { w: 3.5 }); b.arrow(-330, 55, -130, -125, { w: 3.5, c: c.danger }); [[-190, -50], [0, 155], [180, -50]].forEach(([x, y]) => b.cell(x! - 90, y! - 4, 180, 40, { c: c.ink, w: 2, dash: true, ph: "Process?", size: 20 })); } },
  { id: "geo-tectonic", pack: "geography", label: "Plate boundaries", sub: "constructive · destructive · conservative", levels: ["standard", "advanced"], make: (b, c) => { const types: [string, number, number][][] = [[["Constructive (diverging)", -1, 1]], [["Destructive (converging)", 1, -1]], [["Conservative (sliding)", 1, 1]]]; types.forEach((t, i) => { const x = i * 330; b.rect(x, 0, 150, 60, { c: c.ink, w: 3, fill: "#f3e3c8" }); b.rect(x + 170, 0, 150, 60, { c: c.ink, w: 3, fill: "#e6d2b0" }); b.tc(x + 160, -34, t[0]![0], { size: 16, bold: true }); const a = i === 0 ? [[x + 10, -12, x - 40, -12], [x + 310, -12, x + 360, -12]] : i === 1 ? [[x - 40, -12, x + 20, -12], [x + 360, -12, x + 300, -12]] : [[x + 75, 90, x + 75, 130], [x + 245, 130, x + 245, 90]]; a.forEach(([x1, y1, x2, y2]) => b.arrow(x1!, y1!, x2!, y2!, { c: c.danger, w: 4 })); }); } },
  { id: "geo-pyramid", pack: "geography", label: "Population pyramid", sub: "17 age bands · bars, axis and typeable value boxes", levels: ["standard", "advanced"],
    params: [
      { k: "mode", label: "Bars", type: "select", def: "Example numbers (type over them)", options: ["Example numbers (type over them)", "Blank bars for students"] },
      { k: "max", label: "Scale: % at the outer edge", type: "number", def: 6 },
      { k: "male", label: "Male % for each age band, youngest first (comma separated)", type: "list", def: "5.2, 5.0, 4.8, 4.6, 4.4, 4.1, 3.8, 3.4, 3.0, 2.6, 2.2, 1.8, 1.4, 1.0, 0.7, 0.4, 0.2" },
      { k: "female", label: "Female % for each age band, youngest first", type: "list", def: "5.0, 4.8, 4.6, 4.5, 4.3, 4.1, 3.8, 3.5, 3.1, 2.7, 2.3, 1.9, 1.5, 1.2, 0.9, 0.6, 0.4" },
    ],
    make: (b, c, v) => {
      const ages = ["0–4", "5–9", "10–14", "15–19", "20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65–69", "70–74", "75–79", "80+"];
      const RH = 28, HALF = 300, MID = 36, n = ages.length, top = 0, bottom = n * RH;
      const max = Math.max(1, num(v.max, 6)), blank = String(v.mode).startsWith("Blank");
      const male = list(v.male).map(Number), female = list(v.female).map(Number);
      const MALE = c.brand, FEMALE = c.danger;
      // gridlines + the % axis first, so the bars sit on top of them
      for (let k = 0; k <= 5; k++) {
        const off = MID + (HALF * k) / 5, label = String(Math.round(((max * k) / 5) * 10) / 10);
        for (const sgn of [-1, 1]) { b.line(sgn * off, top - 6, sgn * off, bottom + 4, { w: 1, c: "#c3cde2" }); b.tc(sgn * off, bottom + 20, label, { size: 13, c: "#5b6b8c" }); }
      }
      b.line(-MID - HALF - 8, bottom + 4, MID + HALF + 8, bottom + 4, { w: 2.5 });
      ages.forEach((a, i) => {
        const y = (n - 1 - i) * RH; // youngest at the bottom
        const bar = (sgn: 1 | -1, val: number | undefined, col: string) => {
          const w = blank ? HALF : Math.max(6, Math.min(HALF, ((val ?? 0) / max) * HALF)), x0 = sgn < 0 ? -MID - w : MID;
          b.cell(x0, y + 1, w, RH - 2, { c: col, w: blank ? 1.4 : 1, fill: blank ? null : col, dash: blank, text: blank || val === undefined || !Number.isFinite(val) ? undefined : String(val), size: 13, bold: true, tc: "#ffffff", al: sgn < 0 ? "l" : "r" });
        };
        bar(-1, male[i], MALE); bar(1, female[i], FEMALE);
        b.cell(-MID, y, MID * 2, RH, { text: a, size: 14, bold: true, ns: true, w: 0.01, c: "#ffffff" });
      });
      b.tc(-MID - HALF / 2, top - 30, "Male (%)", { size: 20, bold: true, c: MALE }); b.tc(MID + HALF / 2, top - 30, "Female (%)", { size: 20, bold: true, c: FEMALE });
      b.tc(0, bottom + 48, "Percentage of the population", { size: 15, c: "#5b6b8c" });
      b.tc(0, top - 62, blank ? "Population pyramid — shade each bar to the right length" : "Population pyramid — example numbers, not a real country", { size: 18, bold: true });
    } },
  { id: "geo-field", pack: "geography", label: "Fieldwork results table + graph frame", levels: ["standard", "advanced"], params: [{ k: "cols", label: "Column headings", type: "list", def: "Site, Width (m), Depth (cm), Speed (m/s)" }, { k: "rows", label: "Rows", type: "number", def: 6 }], make: (b, c, v) => { const h = list(v.cols, ["Site", "Result"]).slice(0, 6); b.table(0, 0, h.map(() => 150), [54, ...Array(Math.min(12, num(v.rows, 6))).fill(52)], { head: h, headFill: "#eaf0fc", size: 19 }); const gx = h.length * 150 + 60; b.arrow(gx, 330, gx, 0, { w: 3 }); b.arrow(gx, 330, gx + 420, 330, { w: 3 }); void c; } },
];
