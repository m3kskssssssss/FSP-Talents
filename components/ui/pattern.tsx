import { cn } from "./cn";

/**
 * Generative brand pattern: the booklet's "дорожки" (thin lines with rounded
 * turns and dots at the ends), a dot grid and a "molecule" cluster from the FSP
 * logo. Deterministic: the same seed always draws the same picture, so server
 * and client render identically and an article keeps its cover.
 *
 * Colours come from `currentColor` (set `text-accent` or similar on the parent)
 * plus one small `fill-red` mark. `animated` draws the lines in and pops the
 * nodes (see .pattern-draw / .pattern-pop in globals.css).
 */
export function Pattern({
  seed,
  className,
  animated = false,
  density = 1,
}: {
  seed: string;
  className?: string;
  animated?: boolean;
  density?: number;
}) {
  const p = buildPattern(seed, density);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("block", className)}
      fill="none"
    >
      <g fill="currentColor" opacity="0.28">
        {p.dots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />
        ))}
      </g>
      {p.tracks.map((t, i) => (
        <g key={i}>
          <path
            d={t.d}
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            pathLength={1}
            className={animated ? "pattern-draw" : undefined}
            style={animated ? { animationDelay: `${i * 160}ms` } : undefined}
          />
          <circle cx={t.start[0]} cy={t.start[1]} r="4" fill="currentColor" />
          <circle cx={t.end[0]} cy={t.end[1]} r="2.5" fill="currentColor" />
          <circle cx={t.end[0]} cy={t.end[1]} r="6.5" stroke="currentColor" strokeWidth="1.3" />
        </g>
      ))}
      <g
        className={animated ? "pattern-pop" : undefined}
        style={animated ? { transformOrigin: `${p.molecule.cx}px ${p.molecule.cy}px` } : undefined}
      >
        {p.molecule.edges.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={p.molecule.nodes[a]![0]}
            y1={p.molecule.nodes[a]![1]}
            x2={p.molecule.nodes[b]![0]}
            y2={p.molecule.nodes[b]![1]}
            stroke="currentColor"
            strokeWidth="3"
          />
        ))}
        {p.molecule.nodes.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="currentColor" />
        ))}
      </g>
      <circle cx={p.red[0]} cy={p.red[1]} r="5" className="fill-red" />
    </svg>
  );
}

const W = 400;
const H = 240;
const STEP = 40;

type Pt = [number, number];

/** mulberry32 seeded by a string hash: tiny, fast, good enough for decoration. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Polyline with every corner rounded by a quadratic curve, like the booklet's tracks. */
function roundedPath(pts: Pt[], radius: number) {
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]!;
    const [cx, cy] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    d += ` L${r1(cx - ((cx - px) / l1) * r)} ${r1(cy - ((cy - py) / l1) * r)} Q${cx} ${cy} ${r1(cx + ((nx - cx) / l2) * r)} ${r1(cy + ((ny - cy) / l2) * r)}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L${last[0]} ${last[1]}`;
}

export function buildPattern(seed: string, density = 1) {
  const rand = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const cols = W / STEP;
  const rows = H / STEP;

  // dot grid in one random rectangle
  const gx = int(0, cols - 4);
  const gy = int(0, rows - 3);
  const gw = int(3, 5);
  const gh = int(2, 3);
  const dots: Pt[] = [];
  for (let x = gx; x <= Math.min(cols, gx + gw); x++)
    for (let y = gy; y <= Math.min(rows, gy + gh); y++)
      dots.push([x * STEP + STEP / 2, y * STEP + STEP / 2]);

  // tracks: alternate horizontal / vertical runs on the grid
  const tracks: { d: string; start: Pt; end: Pt }[] = [];
  const nTracks = Math.max(1, Math.round(int(2, 3) * density));
  for (let t = 0; t < nTracks; t++) {
    let x = int(1, cols - 1) * STEP;
    let y = int(1, rows - 1) * STEP;
    const pts: Pt[] = [[x, y]];
    let horizontal = rand() < 0.5;
    const turns = int(2, 4);
    for (let k = 0; k <= turns; k++) {
      const len = int(2, 5) * STEP * (rand() < 0.5 ? -1 : 1);
      if (horizontal) {
        let nx = x + len;
        if (nx < STEP / 2 || nx > W - STEP / 2) nx = x - len;
        x = Math.max(STEP / 2, Math.min(W - STEP / 2, nx));
      } else {
        let ny = y + len;
        if (ny < STEP / 2 || ny > H - STEP / 2) ny = y - len;
        y = Math.max(STEP / 2, Math.min(H - STEP / 2, ny));
      }
      const prev = pts[pts.length - 1]!;
      if (prev[0] !== x || prev[1] !== y) pts.push([x, y]);
      horizontal = !horizontal;
    }
    if (pts.length < 2) pts.push([Math.min(W - STEP / 2, x + STEP * 3), y]);
    tracks.push({ d: roundedPath(pts, int(16, 28)), start: pts[0]!, end: pts[pts.length - 1]! });
  }

  // molecule: nodes on a hex lattice around a centre, edges between neighbours
  const cx = int(2, cols - 2) * STEP;
  const cy = int(1, rows - 2) * STEP + STEP / 2;
  const unit = 22;
  const lattice: Pt[] = [
    [0, 0],
    [1, 0],
    [0.5, 0.87],
    [-0.5, 0.87],
    [-1, 0],
    [-0.5, -0.87],
    [0.5, -0.87],
    [1.5, 0.87],
    [1, 1.73],
  ];
  const count = int(4, 6);
  const picked = [
    lattice[0]!,
    ...lattice
      .slice(1)
      .sort(() => rand() - 0.5)
      .slice(0, count - 1),
  ];
  const nodes = picked.map(([u, v]) => [r1(cx + u * unit), r1(cy + v * unit), int(5, 8)] as const);
  const edges: [number, number][] = [];
  for (let a = 0; a < picked.length; a++)
    for (let b = a + 1; b < picked.length; b++) {
      const dist = Math.hypot(picked[a]![0] - picked[b]![0], picked[a]![1] - picked[b]![1]);
      if (dist < 1.05) edges.push([a, b]);
    }
  // a node with no neighbour hangs on to the nearest one, so the cluster reads as one molecule
  for (let a = 1; a < picked.length; a++) {
    if (edges.some(([x, y]) => x === a || y === a)) continue;
    const dist = (b: number) =>
      Math.hypot(picked[a]![0] - picked[b]![0], picked[a]![1] - picked[b]![1]);
    const nearest = picked
      .map((_, b) => b)
      .filter((b) => b !== a)
      .sort((m, n) => dist(m) - dist(n))[0]!;
    edges.push([Math.min(a, nearest), Math.max(a, nearest)]);
  }

  const red: Pt = [int(1, cols - 1) * STEP + STEP / 2, int(0, rows - 1) * STEP + STEP / 2];
  return { dots, tracks, molecule: { cx, cy, nodes, edges }, red };
}
