/* ══════════════════════════════════════════════════════
   MILKY — SVG artwork → smooth solid leaf
   ──────────────────────────────────────────────────────
   The grid approach could reproduce the artwork's shape or keep its edges
   smooth, never both: a silhouette made by culling quads off a lattice is
   stair-stepped by construction.

   So this abandons the grid. The path's contours are sampled directly off the
   curve, triangulated as a real polygon with holes, and the resulting flat
   mesh is then bent into three dimensions. Every boundary — outer edge, split
   and fenestration alike — follows the Bezier exactly, at any resolution.

     1  sample each subpath into a contour
     2  work out which contours are holes
     3  bridge the holes into one simple polygon
     4  ear-clip it into triangles
     5  bend the flat mesh: droop, cup, roll
     6  offset front and back, wall every contour with a rim
   ══════════════════════════════════════════════════════ */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ── 1. sample the path into contours ───────────────────
   Subpath breaks are found by looking for a jump: getPointAtLength walks by
   arc length, so consecutive samples are evenly spaced *within* a contour and
   only teleport where one subpath ends and the next begins. */
export function contoursFromPath(d, { perContour = 260 } = {}) {
  /* Sampling the whole compound path was pathological: getPointAtLength walks
     from the start of the path on every call, so on a 6 KB path with 16
     subpaths the cost is quadratic — several seconds, and a visible freeze on
     load. Each subpath is measured on its own instead, which keeps every walk
     short and lets the sample count follow the contour's own length. */
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;opacity:0';
  document.body.appendChild(svg);

  const contours = [];
  try {
    // subpaths begin at an absolute M, so they can be split without a parser
    const parts = d.split(/(?=M)/).map(x => x.trim()).filter(Boolean);
    const els = parts.map(sub => {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', sub);
      svg.appendChild(el);
      return el;
    });
    const lens = els.map(el => { try { return el.getTotalLength(); } catch (_) { return 0; } });
    const longest = Math.max(...lens, 1);

    els.forEach((el, i) => {
      const len = lens[i];
      if (len < 1) return;
      // shorter contours need fewer points to stay smooth
      const n = Math.max(24, Math.round(perContour * Math.sqrt(len / longest)));
      const pts = new Array(n);
      for (let k = 0; k < n; k++) {
        const q = el.getPointAtLength((len * k) / n);
        pts[k] = [q.x, q.y];
      }
      contours.push(pts);
    });
  } finally { svg.remove(); }

  return contours.filter(c => c.length > 8).map(dedupe);
}

function dedupe(c) {
  const out = [c[0]];
  for (let i = 1; i < c.length; i++) {
    const p = c[i], q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  // a closed contour repeats its first point at the end
  const a = out[0], b = out[out.length - 1];
  if (out.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) out.pop();
  return out;
}

/** Douglas–Peucker, so lower LODs carry fewer points without losing the curve */
export function simplify(c, tol) {
  if (tol <= 0 || c.length < 4) return c;
  const keep = new Uint8Array(c.length);
  keep[0] = keep[c.length - 1] = 1;
  const stack = [[0, c.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = 0, idx = -1;
    const [ax, ay] = c[a], [bx, by] = c[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const dist = Math.abs((c[i][0] - ax) * dy - (c[i][1] - ay) * dx) / len;
      if (dist > worst) { worst = dist; idx = i; }
    }
    if (worst > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return c.filter((_, i) => keep[i]);
}

/* ── 2. which contours are holes ────────────────────── */
export function area2(c) {
  let a = 0;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    a += (c[j][0] - c[i][0]) * (c[j][1] + c[i][1]);
  }
  return a / 2;
}

function inside(pt, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function splitOuterAndHoles(contours) {
  let outer = contours[0], best = Math.abs(area2(contours[0]));
  for (const c of contours) {
    const a = Math.abs(area2(c));
    if (a > best) { best = a; outer = c; }
  }
  const holes = contours.filter(c => c !== outer && inside(c[0], outer));
  return { outer, holes };
}

/* ── 3 + 4. holes bridged in, then ear-clipped ────────
   Each hole is joined to the outer ring by a zero-width bridge at its
   rightmost point, which turns the whole thing into one simple polygon that
   ordinary ear clipping can chew through. */
function orient(c, wantCCW) {
  const ccw = area2(c) > 0;
  return ccw === wantCCW ? c.slice() : c.slice().reverse();
}

export function triangulate(outerIn, holesIn) {
  let poly = orient(outerIn, true);
  const holes = holesIn.map(h => orient(h, false));

  holes.sort((a, b) => Math.max(...b.map(p => p[0])) - Math.max(...a.map(p => p[0])));

  for (const hole of holes) {
    let hi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[hi][0]) hi = i;
    const M = hole[hi];

    // nearest polygon vertex to the right of the hole's rightmost point
    let best = -1, bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      if (p[0] < M[0]) continue;
      const d = (p[0] - M[0]) ** 2 + (p[1] - M[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) {   // hole is right of everything: fall back to nearest overall
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const d = (p[0] - M[0]) ** 2 + (p[1] - M[1]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }

    const rotated = hole.slice(hi).concat(hole.slice(0, hi));
    poly = poly.slice(0, best + 1)
      .concat(rotated, [rotated[0]], poly.slice(best));
  }

  return { poly, tris: earClip(poly) };
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function pointInTri(p, a, b, c) {
  const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function earClip(poly) {
  const n = poly.length;
  if (n < 3) return [];

  /* A linked list, and a scan that resumes where it left off rather than
     restarting from the top after every clip. Restarting made this O(n³) —
     4.8 seconds to build the hero leaf, a visible freeze on page load.
     Containment is also only tested against reflex vertices, since a convex
     one can never sit inside a candidate ear. */
  const prev = new Int32Array(n), next = new Int32Array(n);
  for (let i = 0; i < n; i++) { prev[i] = (i - 1 + n) % n; next[i] = (i + 1) % n; }

  const reflex = i => cross(poly[prev[i]], poly[i], poly[next[i]]) <= 0;

  const tris = [];
  let remaining = n, cur = 0, misses = 0;

  while (remaining > 3) {
    const i0 = prev[cur], i1 = cur, i2 = next[cur];
    const a = poly[i0], b = poly[i1], c = poly[i2];

    let ear = cross(a, b, c) > 1e-12;
    if (ear) {
      for (let j = next[i2]; j !== i0; j = next[j]) {
        const q = poly[j];
        if (q === a || q === b || q === c) continue;
        if (reflex(j) && pointInTri(q, a, b, c)) { ear = false; break; }
      }
    }

    if (ear) {
      tris.push(i0, i1, i2);
      next[i0] = i2; prev[i2] = i0;
      remaining--; cur = i2; misses = 0;
      continue;
    }

    cur = next[cur];
    if (++misses <= remaining) continue;

    /* Wedged — the doubled vertices a hole bridge introduces can leave no
       valid ear anywhere. Drop the sharpest sliver and carry on; bailing out
       here is what silently lost 40% of the leaf. */
    let worst = cur, area = Infinity, k = cur;
    do {
      const A = Math.abs(cross(poly[prev[k]], poly[k], poly[next[k]]));
      if (A < area) { area = A; worst = k; }
      k = next[k];
    } while (k !== cur);
    next[prev[worst]] = next[worst];
    prev[next[worst]] = prev[worst];
    remaining--; cur = next[worst]; misses = 0;
  }

  tris.push(prev[cur], cur, next[cur]);
  return tris;
}

/* ── 5 + 6. bend it, thicken it, wall it ─────────────
   The triangulated outline is flat. Every vertex is pushed through the same
   droop / cup / roll mapping the parametric species use, so an artwork leaf
   behaves in the wind exactly like a generated one. Normals come from finite
   differences of that mapping, which keeps the surface smoothly shaded
   however coarse the triangulation is.                                  */
export function bladeFromContours({
  outer, holes, scale = 1.4, thickness = 0.022, roll = 0.10,
  curl = t => 0.36 + 0.24 * (1 - t),
  droop = t => [t * (1 - 0.12 * t * t), -0.32 * t * t]
}) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of [outer, ...holes]) for (const [x, y] of c) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const midX = (minX + maxX) / 2;

  /* artwork space → leaf space. u across (0 at the midrib), t along (0 base) */
  const uOf = x => ((x - midX) / spanX) * scale;
  const tOf = y => 1 - (y - minY) / spanY;

  const map = (u, t) => {
    const [my, mz] = droop(t);
    const z = mz + curl(t) * u * u;
    const tw = roll * t, ct = Math.cos(tw), st = Math.sin(tw);
    return [u * ct - z * st, my, u * st + z * ct];
  };

  const EPS = 1e-3;
  const normalAt = (u, t) => {
    const p = map(u, t);
    const a = map(u + EPS, t), b = map(u, Math.min(1, t + EPS));
    const t1 = [a[0] - p[0], a[1] - p[1], a[2] - p[2]];
    const t2 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
    let n = [t1[1] * t2[2] - t1[2] * t2[1],
             t1[2] * t2[0] - t1[0] * t2[2],
             t1[0] * t2[1] - t1[1] * t2[0]];
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / L, n[1] / L, n[2] / L];
    return n[2] < 0 ? [-n[0], -n[1], -n[2]] : n;   // keep the face pointing out
  };

  const { poly, tris } = triangulate(outer, holes);
  const h = thickness * 0.5;

  const P = poly.map(([x, y]) => {
    const u = uOf(x), t = tOf(y);
    const p = map(u, t), n = normalAt(u, t);
    return {
      f: [p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h],
      b: [p[0] - n[0] * h, p[1] - n[1] * h, p[2] - n[2] * h],
      n, uv: [(u / scale) + 0.5, t]
    };
  });

  const pos = [], nrm = [], uv = [];
  const tri = (A, B, C, nA, nB, nC, uA, uB, uC) => {
    pos.push(...A, ...B, ...C);
    nrm.push(...nA, ...nB, ...nC);
    uv.push(...uA, ...uB, ...uC);
  };
  const neg = n => [-n[0], -n[1], -n[2]];

  for (let i = 0; i < tris.length; i += 3) {
    const a = P[tris[i]], b = P[tris[i + 1]], c = P[tris[i + 2]];
    tri(a.f, b.f, c.f, a.n, b.n, c.n, a.uv, b.uv, c.uv);
    tri(a.b, c.b, b.b, neg(a.n), neg(c.n), neg(b.n), a.uv, c.uv, b.uv);
  }

  /* Rims follow the ORIGINAL contours, not the bridged ring — the bridge is an
     artefact of triangulation and has no edge to wall. */
  for (const c of [outer, ...holes]) {
    for (let i = 0; i < c.length; i++) {
      const p0 = c[i], p1 = c[(i + 1) % c.length];
      const u0 = uOf(p0[0]), t0 = tOf(p0[1]);
      const u1 = uOf(p1[0]), t1 = tOf(p1[1]);
      const m0 = map(u0, t0), m1 = map(u1, t1);
      const n0 = normalAt(u0, t0), n1 = normalAt(u1, t1);
      const f0 = [m0[0] + n0[0] * h, m0[1] + n0[1] * h, m0[2] + n0[2] * h];
      const b0 = [m0[0] - n0[0] * h, m0[1] - n0[1] * h, m0[2] - n0[2] * h];
      const f1 = [m1[0] + n1[0] * h, m1[1] + n1[1] * h, m1[2] + n1[2] * h];
      const b1 = [m1[0] - n1[0] * h, m1[1] - n1[1] * h, m1[2] - n1[2] * h];

      // edge tangent × surface normal gives the outward-facing wall normal
      const e = [f1[0] - f0[0], f1[1] - f0[1], f1[2] - f0[2]];
      let rn = [e[1] * n0[2] - e[2] * n0[1],
                e[2] * n0[0] - e[0] * n0[2],
                e[0] * n0[1] - e[1] * n0[0]];
      const L = Math.hypot(rn[0], rn[1], rn[2]) || 1;
      rn = [rn[0] / L, rn[1] / L, rn[2] / L];

      const uvA = [(u0 / scale) + 0.5, t0], uvB = [(u1 / scale) + 0.5, t1];
      tri(f0, f1, b1, rn, rn, rn, uvA, uvB, uvB);
      tri(f0, b1, b0, rn, rn, rn, uvA, uvB, uvA);
    }
  }

  return { pos, nrm, uv };
}
