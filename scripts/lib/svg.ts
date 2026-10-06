/**
 * Minimal static SVG charts for docs/validation.md. Light surface, thin marks,
 * recessive grid, values in text ink; series colours validated for CVD
 * (violet = platform, orange = baseline).
 */
export const C = { violet: "#402FFF", orange: "#D97A1E", ink: "#1B1C21", muted: "#5B5D66", grid: "#E6E6EA", surface: "#FFFFFF" };
const FONT = `font-family="Golos Text, Inter, Arial, sans-serif"`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = (v: number, d = 2) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));

function frame(w: number, h: number, title: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<rect width="${w}" height="${h}" fill="${C.surface}"/>
<text x="16" y="26" ${FONT} font-size="15" font-weight="600" fill="${C.ink}">${esc(title)}</text>
${body}
</svg>`;
}

function legend(x: number, y: number, series: { name: string; color: string }[]) {
  let cx = x;
  return series
    .map((s) => {
      const el = `<rect x="${cx}" y="${y - 9}" width="10" height="10" rx="2" fill="${s.color}"/><text x="${cx + 16}" y="${y}" ${FONT} font-size="12" fill="${C.ink}">${esc(s.name)}</text>`;
      cx += 16 + s.name.length * 6.6 + 18;
      return el;
    })
    .join("");
}

/** Grouped vertical bars, y in [0, max]. */
export function groupedBars(o: { title: string; groups: string[]; series: { name: string; color: string; values: number[] }[]; max?: number; decimals?: number }) {
  const w = 640, h = 340, l = 48, r = 16, t = 64, b = 44;
  const max = o.max ?? Math.max(...o.series.flatMap((s) => s.values)) * 1.15;
  const gw = (w - l - r) / o.groups.length;
  const bw = Math.min(46, (gw - 24) / o.series.length);
  const y = (v: number) => t + (h - t - b) * (1 - v / max);
  let body = legend(l, 50, o.series);
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    body += `<line x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${l - 6}" y="${y(v) + 4}" text-anchor="end" ${FONT} font-size="11" fill="${C.muted}">${fmt(v)}</text>`;
  }
  o.groups.forEach((g, gi) => {
    const x0 = l + gi * gw + (gw - bw * o.series.length - 2 * (o.series.length - 1)) / 2;
    o.series.forEach((s, si) => {
      const v = s.values[gi]!;
      const x = x0 + si * (bw + 2);
      const yy = y(v);
      const hh = h - b - yy;
      // Rounded data-end (top), square baseline.
      body += `<path d="M${x},${h - b} V${yy + 4} Q${x},${yy} ${x + 4},${yy} H${x + bw - 4} Q${x + bw},${yy} ${x + bw},${yy + 4} V${h - b} Z" fill="${s.color}"/>`;
      if (hh >= 0) body += `<text x="${x + bw / 2}" y="${yy - 5}" text-anchor="middle" ${FONT} font-size="11" fill="${C.ink}">${fmt(v, o.decimals ?? 2)}</text>`;
    });
    body += `<text x="${l + gi * gw + gw / 2}" y="${h - b + 18}" text-anchor="middle" ${FONT} font-size="12" fill="${C.ink}">${esc(g)}</text>`;
  });
  body += `<line x1="${l}" x2="${w - r}" y1="${h - b}" y2="${h - b}" stroke="${C.muted}"/>`;
  return frame(w, h, o.title, body);
}

/** Scatter with an optional y = x diagonal. */
export function scatter(o: { title: string; xLabel: string; yLabel: string; points: { x: number; y: number }[]; domain: [number, number]; diagonal?: boolean; color?: string }) {
  const w = 480, h = 420, l = 52, r = 16, t = 44, b = 48;
  const [lo, hi] = o.domain;
  const sx = (v: number) => l + ((v - lo) / (hi - lo)) * (w - l - r);
  const sy = (v: number) => h - b - ((v - lo) / (hi - lo)) * (h - t - b);
  let body = "";
  for (let v = Math.ceil(lo); v <= hi; v++) {
    body += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${t}" y2="${h - b}" stroke="${C.grid}"/><line x1="${l}" x2="${w - r}" y1="${sy(v)}" y2="${sy(v)}" stroke="${C.grid}"/>`;
    body += `<text x="${sx(v)}" y="${h - b + 16}" text-anchor="middle" ${FONT} font-size="11" fill="${C.muted}">${v}</text><text x="${l - 6}" y="${sy(v) + 4}" text-anchor="end" ${FONT} font-size="11" fill="${C.muted}">${v}</text>`;
  }
  if (o.diagonal) body += `<line x1="${sx(lo)}" y1="${sy(lo)}" x2="${sx(hi)}" y2="${sy(hi)}" stroke="${C.muted}" stroke-dasharray="4 4"/>`;
  for (const p of o.points) {
    if (p.x < lo || p.x > hi || p.y < lo || p.y > hi) continue;
    body += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" fill="${o.color ?? C.violet}" fill-opacity="0.45"/>`;
  }
  body += `<text x="${(l + w - r) / 2}" y="${h - 10}" text-anchor="middle" ${FONT} font-size="12" fill="${C.ink}">${esc(o.xLabel)}</text>`;
  body += `<text transform="translate(14 ${(t + h - b) / 2}) rotate(-90)" text-anchor="middle" ${FONT} font-size="12" fill="${C.ink}">${esc(o.yLabel)}</text>`;
  return frame(w, h, o.title, body);
}

/** Heatmap (e.g. confusion matrix) with a single-hue sequential ramp and in-cell values. */
export function heatmap(o: { title: string; rows: string[]; cols: string[]; values: number[][]; rowLabel: string; colLabel: string }) {
  const cell = 76, l = 120, t = 76;
  const w = l + cell * o.cols.length + 24, h = t + cell * o.rows.length + 40;
  const max = Math.max(1, ...o.values.flat());
  let body = `<text x="${l + (cell * o.cols.length) / 2}" y="${t - 30}" text-anchor="middle" ${FONT} font-size="12" fill="${C.muted}">${esc(o.colLabel)}</text>`;
  body += `<text x="16" y="${t - 8}" ${FONT} font-size="12" fill="${C.muted}">${esc(o.rowLabel)}</text>`;
  o.cols.forEach((c, j) => (body += `<text x="${l + j * cell + cell / 2}" y="${t - 10}" text-anchor="middle" ${FONT} font-size="12" fill="${C.ink}">${esc(c)}</text>`));
  o.rows.forEach((rname, i) => {
    body += `<text x="${l - 10}" y="${t + i * cell + cell / 2 + 4}" text-anchor="end" ${FONT} font-size="12" fill="${C.ink}">${esc(rname)}</text>`;
    o.cols.forEach((_, j) => {
      const v = o.values[i]![j]!;
      const a = v / max;
      // Interpolate surface -> violet in sRGB (light to dark = more).
      const mix = (c1: number, c2: number) => Math.round(c1 + (c2 - c1) * (0.08 + 0.92 * a));
      const fill = `rgb(${mix(241, 64)},${mix(239, 47)},${mix(255, 255)})`;
      body += `<rect x="${l + j * cell + 1}" y="${t + i * cell + 1}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="${fill}"/>`;
      body += `<text x="${l + j * cell + cell / 2}" y="${t + i * cell + cell / 2 + 5}" text-anchor="middle" ${FONT} font-size="14" fill="${a > 0.5 ? "#fff" : C.ink}">${v}</text>`;
    });
  });
  return frame(w, h, o.title, body);
}

/** 100% stacked horizontal bars (shares per category). */
export function stackedShares(o: { title: string; rows: string[]; parts: { name: string; color: string }[]; values: number[][] }) {
  const w = 640, l = 190, r = 24, t = 70, rowH = 40;
  const h = t + rowH * o.rows.length + 20;
  let body = legend(16, 52, o.parts);
  o.rows.forEach((rn, i) => {
    const y = t + i * rowH;
    body += `<text x="${l - 10}" y="${y + 19}" text-anchor="end" ${FONT} font-size="12" fill="${C.ink}">${esc(rn)}</text>`;
    let x = l;
    const total = o.values[i]!.reduce((s, v) => s + v, 0) || 1;
    o.values[i]!.forEach((v, k) => {
      const ww = ((w - l - r) * v) / total;
      if (ww <= 0) return;
      body += `<rect x="${x}" y="${y + 4}" width="${Math.max(0, ww - 2)}" height="24" rx="3" fill="${o.parts[k]!.color}"/>`;
      if (ww > 34) body += `<text x="${x + ww / 2 - 1}" y="${y + 20}" text-anchor="middle" ${FONT} font-size="11" fill="#fff">${Math.round((100 * v) / total)}%</text>`;
      x += ww;
    });
  });
  return frame(w, h, o.title, body);
}
