export const COUNT = 80;

export type Point = { x: number; y: number };

export function smallPillPoints(): Point[] {
  const pts: Point[] = [];
  const cx = 50, cy = 50, W = 36, H = 22, R = 11;
  const hw = W / 2 - R;
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT;
    let x: number, y: number;
    if (t < 0.125) { const u = t / 0.125; x = cx + u * hw; y = cy - H / 2; }
    else if (t < 0.375) { const u = (t - 0.125) / 0.25; const a = -Math.PI / 2 + u * Math.PI; x = cx + hw + Math.cos(a) * R; y = cy + Math.sin(a) * R; }
    else if (t < 0.625) { const u = (t - 0.375) / 0.25; x = cx + hw - u * 2 * hw; y = cy + H / 2; }
    else if (t < 0.875) { const u = (t - 0.625) / 0.25; const a = Math.PI / 2 + u * Math.PI; x = cx - hw + Math.cos(a) * R; y = cy + Math.sin(a) * R; }
    else { const u = (t - 0.875) / 0.125; x = cx - hw + u * hw; y = cy - H / 2; }
    pts.push({ x, y });
  }
  return pts;
}

export function pillPoints(): Point[] {
  const pts: Point[] = [];
  const cx = 50, cy = 50, W = 98, H = 34, R = 17;
  const hw = W / 2 - R;
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT;
    let x: number, y: number;
    if (t < 0.125) { const u = t / 0.125; x = cx + u * hw; y = cy - H / 2; }
    else if (t < 0.375) { const u = (t - 0.125) / 0.25; const a = -Math.PI / 2 + u * Math.PI; x = cx + hw + Math.cos(a) * R; y = cy + Math.sin(a) * R; }
    else if (t < 0.625) { const u = (t - 0.375) / 0.25; x = cx + hw - u * 2 * hw; y = cy + H / 2; }
    else if (t < 0.875) { const u = (t - 0.625) / 0.25; const a = Math.PI / 2 + u * Math.PI; x = cx - hw + Math.cos(a) * R; y = cy + Math.sin(a) * R; }
    else { const u = (t - 0.875) / 0.125; x = cx - hw + u * hw; y = cy - H / 2; }
    pts.push({ x, y });
  }
  return pts;
}

export function fullPoints(): Point[] {
  const pts: Point[] = [];
  const left = 0, right = 100, top = 0, bottom = 100;
  const cx = 50;
  const W = right - left, H = bottom - top;
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT;
    let x: number, y: number;
    if (t < 0.125) { const u = t / 0.125; x = cx + u * (right - cx); y = top; }
    else if (t < 0.375) { const u = (t - 0.125) / 0.25; x = right; y = top + u * H; }
    else if (t < 0.625) { const u = (t - 0.375) / 0.25; x = right - u * W; y = bottom; }
    else if (t < 0.875) { const u = (t - 0.625) / 0.25; x = left; y = bottom - u * H; }
    else { const u = (t - 0.875) / 0.125; x = left + u * (cx - left); y = top; }
    pts.push({ x, y });
  }
  return pts;
}

export function toOuterPercent(pts: Point[], W: number, H: number): Point[] {
  const min = Math.min(W, H);
  return pts.map(p => ({
    x: 50 + (p.x - 50) * min / W,
    y: 50 + (p.y - 50) * min / H,
  }));
}

export function lerpPoints(a: Point[], b: Point[], t: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < COUNT; i++) out.push({ x: a[i].x + (b[i].x - a[i].x) * t, y: a[i].y + (b[i].y - a[i].y) * t });
  return out;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function getMaskPoints(t: number, W: number, H: number, s1End = 0.45, s2Start = 0.35): Point[] {
  const c = toOuterPercent(smallPillPoints(), W, H);
  const p = toOuterPercent(pillPoints(), W, H);
  const f = fullPoints();
  const s1 = smoothstep(0, s1End, t);
  const s2 = smoothstep(s2Start, 1, t);
  const tmp = lerpPoints(c, p, s1);
  return lerpPoints(tmp, f, s2);
}

export function pointsToPolygon(pts: Point[]): string {
  return `polygon(${pts.map(p => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(', ')})`;
}
