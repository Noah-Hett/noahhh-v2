// Contour-aware path interpolation: resamples both outlines to matched
// rings and lerps point-to-point. Consumed by morphWord.ts.
type Point = [number, number];

const CURVE_STEPS = 14;
const RING_POINTS = 110;

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, out: Point[]): void {
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

function sampleQuad(p0: Point, p1: Point, p2: Point, out: Point[]): void {
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS, u = 1 - t;
    out.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
}

function subpathsOf(d: string): Point[][] {
  const re = /([MLQCZ])([^MLQCZmlqcz]*)/g;
  const subs: Point[][] = [];
  let cur: Point[] | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    if (cmd === "M") {
      if (cur && cur.length > 2) subs.push(cur);
      cur = [nums.slice(0, 2) as Point];
    } else if (!cur) {
      continue;
    } else if (cmd === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) cur.push(nums.slice(i, i + 2) as Point);
    } else if (cmd === "C") {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        sampleCubic(cur[cur.length - 1], nums.slice(i, i + 2) as Point, nums.slice(i + 2, i + 4) as Point, nums.slice(i + 4, i + 6) as Point, cur);
      }
    } else if (cmd === "Q") {
      for (let i = 0; i + 3 < nums.length; i += 4) {
        sampleQuad(cur[cur.length - 1], nums.slice(i, i + 2) as Point, nums.slice(i + 2, i + 4) as Point, cur);
      }
    }
  }
  if (cur && cur.length > 2) subs.push(cur);
  return subs;
}

function resampleRing(src: Point[], n: number): Point[] {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 0; i < src.length; i++) {
    const a = src[i], b = src[(i + 1) % src.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    cum.push(total);
  }
  const out: Point[] = [];
  let seg = 0;
  for (let j = 0; j < n; j++) {
    const target = (j / n) * total;
    while (seg < src.length - 1 && cum[seg + 1] < target) seg++;
    const a = src[seg], b = src[(seg + 1) % src.length];
    const span = cum[seg + 1] - cum[seg] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[seg]) / span));
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

function shoelace(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function centroidOf(pts: Point[]): Point {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

function pointInPoly(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

type Ring = { pts: Point[]; area: number; cent: Point; depth: number; isHole?: boolean };

function analyzeRings(subs: Point[][]): Ring[] {
  const rings: Ring[] = subs.map((raw) => {
    const pts = resampleRing(raw, RING_POINTS);
    return { pts, area: shoelace(pts), cent: centroidOf(pts), depth: 0 };
  });
  for (const r of rings) {
    for (const o of rings) {
      if (o === r) continue;
      let hits = 0;
      const samples = Math.min(17, r.pts.length);
      for (let k = 0; k < samples; k++) {
        if (pointInPoly(r.pts[Math.floor((k * r.pts.length) / samples)], o.pts)) hits++;
      }
      if (hits * 2 > samples) r.depth++;
    }
  }
  for (const r of rings) {
    r.isHole = r.depth % 2 === 1;
    const pos = r.area > 0;
    if (pos === r.isHole) r.pts.reverse();
  }
  return rings;
}

function collapseTo(n: number, cent: Point): Point[] {
  return Array.from({ length: n }, () => cent.slice() as Point);
}

function bestRotation(a: Point[], b: Point[]): number {
  const n = a.length;
  const step = Math.max(1, Math.floor(n / 24));
  let bestR = 0, bestCost = Infinity;
  for (let r = 0; r < n; r++) {
    let cost = 0;
    for (let k = 0; k < n; k += step) {
      const dx = a[k][0] - b[(k + r) % n][0];
      const dy = a[k][1] - b[(k + r) % n][1];
      cost += dx * dx + dy * dy;
    }
    if (cost < bestCost) { bestCost = cost; bestR = r; }
  }
  return bestR;
}

export function contourInterpolate(dA: string, dB: string): (t: number) => string {
  const A = analyzeRings(subpathsOf(dA));
  const B = analyzeRings(subpathsOf(dB));
  const plans: Array<{ a: Point[]; b: Point[] }> = [];

  for (const isHole of [false, true] as const) {
    const ga = A.filter((r) => r.isHole === isHole).sort((x, y) => Math.abs(y.area) - Math.abs(x.area));
    const gb = B.filter((r) => r.isHole === isHole).sort((x, y) => Math.abs(y.area) - Math.abs(x.area));
    const count = Math.max(ga.length, gb.length);
    for (let i = 0; i < count; i++) {
      const ra = ga[i], rb = gb[i];
      if (ra && rb) {
        const r = bestRotation(ra.pts, rb.pts);
        const rotated = rb.pts.slice(r).concat(rb.pts.slice(0, r));
        plans.push({ a: ra.pts, b: rotated });
      } else if (ra) {
        plans.push({ a: ra.pts, b: collapseTo(ra.pts.length, rb ? rb.cent : ra.cent) });
      } else if (rb) {
        plans.push({ a: collapseTo(rb.pts.length, rb.cent), b: rb.pts });
      }
    }
  }

  return function at(t: number): string {
    let d = "";
    for (const p of plans) {
      const a = p.a, b = p.b;
      d += "M";
      for (let i = 0; i < a.length; i++) {
        d += (i ? "L" : "") + (a[i][0] + (b[i][0] - a[i][0]) * t).toFixed(2) + " " + (a[i][1] + (b[i][1] - a[i][1]) * t).toFixed(2) + " ";
      }
      d += "Z";
    }
    return d;
  };
}
