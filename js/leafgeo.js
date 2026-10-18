/* ══════════════════════════════════════════════════════
   MILKY — leaf geometry
   ──────────────────────────────────────────────────────
   Solid leaves. Not a skin, not a card.

   Each blade is lofted along a drooping midrib, then given
   real wall thickness: the mid-surface is offset front and
   back along its own normal and every open edge is stitched
   with a rim. That means the monstera's splits and holes
   show the thickness of the leaf when the neon rakes across
   them, which is the whole reason for doing it.

   Each leaf also carries its own petiole — a tapered tube
   curving down from the blade to y=0. Instances are placed
   with y=0 sitting on a plant's crown, so every stem in a
   plant converges on one point.

   Attributes: position, normal, uv, bend (0 at crown → 1 at tip)
   ══════════════════════════════════════════════════════ */

import * as THREE from './vendor/three.module.js';
import { MONSTERA_CONTOURS } from './leafcontours.js';
import { contoursFromPath, splitOuterAndHoles, simplify, bladeFromContours }
  from './leafshape.js';

/* ── scratch ─────────────────────────────────────────── */
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _c = new THREE.Vector3(), _d = new THREE.Vector3();

function emptyMesh() { return { pos: [], nrm: [], uv: [] }; }

/** Cubic Bezier on a scalar — used to draw leaf outlines as real curves
 *  rather than as a power-of-sine approximation. */
function bez(t, a, b, c, d) {
  const u = 1 - t, u2 = u * u, t2 = t * t;
  return u2 * u * a + 3 * u2 * t * b + 3 * u * t2 * c + t2 * t * d;
}

/** LOD picker. detail 2 = hero (fills a third of the screen and must not
 *  show a single facet), 1 = near slabs, 0 = far slabs behind the DOF. */
function L(d, hero, near, far) {
  return d >= 2 ? hero : d >= 1 ? near : far;
}

function pushTri(m, p0, n0, u0, p1, n1, u1, p2, n2, u2) {
  m.pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  m.nrm.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
  m.uv.push(u0[0], u0[1], u1[0], u1[1], u2[0], u2[1]);
}

/* a flat quad with one shared normal */
function pushQuad(m, p0, p1, p2, p3, n, uv0, uv1, uv2, uv3) {
  pushTri(m, p0, n, uv0, p1, n, uv1, p2, n, uv2);
  pushTri(m, p0, n, uv0, p2, n, uv2, p3, n, uv3);
}

function faceNormal(p0, p1, p2, out) {
  _c.subVectors(p1, p0);
  _d.subVectors(p2, p0);
  return out.crossVectors(_c, _d).normalize();
}

/* ══ solid blade ═══════════════════════════════════════
   Builds the mid-surface on a grid, offsets it to two
   shells, then walls every open boundary.
   ═══════════════════════════════════════════════════ */
function solidBlade({ segsT, segsS, width, curl, droop, keep, roll = 0, thickness }) {
  const cols = segsS + 1, rows = segsT + 1;
  const P = [];      // mid-surface points
  const UV = [];

  for (let i = 0; i < rows; i++) {
    const t = i / segsT;
    const w = width(t), cu = curl(t);
    const [my, mz] = droop(t);
    const tw = roll * t, ct = Math.cos(tw), st = Math.sin(tw);

    for (let j = 0; j < cols; j++) {
      const s = (j / segsS) * 2 - 1;
      const x = s * w;
      const z = mz + cu * (s * s) * w;
      P.push(new THREE.Vector3(x * ct - z * st, my, x * st + z * ct));
      UV.push([(s + 1) * 0.5, t]);
    }
  }

  /* mid-surface normals by central difference on the grid */
  const N = [];
  const at = (i, j) => P[i * cols + j];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const iA = Math.min(i + 1, rows - 1), iB = Math.max(i - 1, 0);
      const jA = Math.min(j + 1, cols - 1), jB = Math.max(j - 1, 0);
      _a.subVectors(at(iA, j), at(iB, j));      // along the midrib
      _b.subVectors(at(i, jA), at(i, jB));      // across the blade
      const n = new THREE.Vector3().crossVectors(_b, _a);
      if (n.lengthSq() < 1e-12) n.set(0, 0, 1); else n.normalize();
      N.push(n);
    }
  }

  const h = thickness * 0.5;
  const front = P.map((p, k) => p.clone().addScaledVector(N[k], h));
  const back  = P.map((p, k) => p.clone().addScaledVector(N[k], -h));

  const kept = [];
  for (let i = 0; i < segsT; i++) {
    for (let j = 0; j < segsS; j++) {
      const tc = (i + 0.5) / segsT, sc = ((j + 0.5) / segsS) * 2 - 1;
      kept.push(keep ? !!keep(tc, sc) : true);
    }
  }
  const isKept = (i, j) =>
    i >= 0 && j >= 0 && i < segsT && j < segsS && kept[i * segsS + j];

  const m = emptyMesh();
  const nrm = new THREE.Vector3();

  for (let i = 0; i < segsT; i++) {
    for (let j = 0; j < segsS; j++) {
      if (!kept[i * segsS + j]) continue;
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;

      // front shell — smooth-shaded from the mid-surface normals
      pushTri(m, front[a], N[a], UV[a], front[c], N[c], UV[c], front[b], N[b], UV[b]);
      pushTri(m, front[b], N[b], UV[b], front[c], N[c], UV[c], front[d], N[d], UV[d]);

      // back shell — reversed winding and flipped normals
      const fa = N[a].clone().negate(), fb = N[b].clone().negate();
      const fc = N[c].clone().negate(), fd = N[d].clone().negate();
      pushTri(m, back[a], fa, UV[a], back[b], fb, UV[b], back[c], fc, UV[c]);
      pushTri(m, back[b], fb, UV[b], back[d], fd, UV[d], back[c], fc, UV[c]);

      // rim — wall off any edge with no neighbour, including hole borders
      const walls = [
        [!isKept(i, j - 1), a, c],   // inner side
        [!isKept(i, j + 1), d, b],   // outer side
        [!isKept(i - 1, j), b, a],   // toward the stem
        [!isKept(i + 1, j), c, d]    // toward the tip
      ];
      for (const [open, u, v] of walls) {
        if (!open) continue;
        faceNormal(front[u], front[v], back[v], nrm);
        pushQuad(m, front[u], front[v], back[v], back[u], nrm,
          UV[u], UV[v], UV[v], UV[u]);
      }
    }
  }
  return m;
}

/* ══ petiole ═══════════════════════════════════════════ */
function stemTube({ segs, radial, radius, path, uvTop }) {
  const m = emptyMesh();
  const ring = (u) => {
    const c = path(u), r = radius(u);
    const nx = path(Math.min(1, u + 0.01)).sub(path(Math.max(0, u - 0.01))).normalize();
    // any two vectors perpendicular to the tangent will do for a round tube
    const up = Math.abs(nx.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const e1 = new THREE.Vector3().crossVectors(up, nx).normalize();
    const e2 = new THREE.Vector3().crossVectors(nx, e1).normalize();
    const pts = [], nms = [];
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const dir = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
      pts.push(c.clone().addScaledVector(dir, r));
      nms.push(dir);
    }
    return { pts, nms };
  };

  let prev = ring(0);
  for (let i = 1; i <= segs; i++) {
    const u = i / segs;
    const cur = ring(u);
    for (let k = 0; k < radial; k++) {
      const v0 = (i - 1) / segs * uvTop, v1 = u * uvTop;
      pushTri(m, prev.pts[k], prev.nms[k], [0.5, v0],
                 cur.pts[k],  cur.nms[k],  [0.5, v1],
                 prev.pts[k + 1], prev.nms[k + 1], [0.5, v0]);
      pushTri(m, prev.pts[k + 1], prev.nms[k + 1], [0.5, v0],
                 cur.pts[k],  cur.nms[k],  [0.5, v1],
                 cur.pts[k + 1], cur.nms[k + 1], [0.5, v1]);
    }
    prev = cur;
  }
  return m;
}

function merge(target, part, offset) {
  for (let i = 0; i < part.pos.length; i += 3) {
    target.pos.push(part.pos[i] + offset.x, part.pos[i + 1] + offset.y, part.pos[i + 2] + offset.z);
  }
  target.nrm.push(...part.nrm);
  target.uv.push(...part.uv);
}

function finish(m) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(m.pos);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(m.nrm), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(m.uv), 2));

  // bend weight: 0 where the stem meets the crown, 1 at the furthest tip
  let maxY = 0;
  for (let i = 1; i < pos.length; i += 3) maxY = Math.max(maxY, pos[i]);
  const bend = new Float32Array(pos.length / 3);
  for (let i = 0; i < bend.length; i++) bend[i] = Math.max(0, pos[i * 3 + 1]) / (maxY || 1);
  g.setAttribute('bend', new THREE.BufferAttribute(bend, 1));

  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/* ══ species ═══════════════════════════════════════════ */

/** blade + its own petiole, stem base at the origin */
function plantPart(bladeCfg, stemCfg) {
  const out = emptyMesh();
  const arch = stemCfg.arch;
  const len  = stemCfg.len;
  const path = (u) => new THREE.Vector3(0, u * len, -arch * u * u);

  merge(out, stemTube({
    segs: stemCfg.segs, radial: stemCfg.radial,
    radius: (u) => stemCfg.r0 * (1 - u * 0.45),
    path, uvTop: 0.12
  }), new THREE.Vector3());

  // the blade starts where the petiole ends
  merge(out, solidBlade(bladeCfg), new THREE.Vector3(0, len, -arch));
  return out;
}

/* Contours are expensive to sample, so they are read off the artwork once and
   reused across every level of detail. */
let _monContours = null;
function monsteraContours() {
  if (_monContours) return _monContours;
  // baked at build time by tools/bake-leaf.js, largest ring first
  const rings = MONSTERA_CONTOURS;
  _monContours = rings && rings.length
    ? { outer: rings[0], holes: rings.slice(1) }
    : null;
  return _monContours;
}

function monstera(d) {
  const src = monsteraContours();

  if (src && src.outer && src.outer.length > 20) {
    /* Built from the real vector outline: sampled off the curve, triangulated
       as a polygon with holes, then bent. No lattice anywhere, so nothing can
       stair-step — the edge is the Bezier at whatever tolerance we simplify to. */
    /* Halved. At 2.6 the near slabs — where most visible foliage lives — kept
       185 of the outline's 1496 points, which is few enough to read as facets
       on a blade a few hundred pixels across. The edge is only ever as round
       as the tolerance it was simplified to. */
    const tol = L(d, 0.35, 0.75, 2.2);
    const outer = simplify(src.outer, tol);
    const holes = src.holes.map(h => simplify(h, tol)).filter(h => h.length > 6);

    const stemLen = 0.62, arch = 0.20;
    const out = emptyMesh();
    merge(out, stemTube({
      segs: L(d, 10, 8, 4), radial: L(d, 10, 7, 4),
      radius: u => 0.028 * (1 - u * 0.45),
      path: u => new THREE.Vector3(0, u * stemLen, -arch * u * u),
      uvTop: 0.12
    }), new THREE.Vector3());

    merge(out, bladeFromContours({
      outer, holes,
      scale: 1.45,
      thickness: 0.022,
      roll: 0.10,
      curl:  t => 0.36 + 0.24 * (1 - t),
      droop: t => [t * (1 - 0.12 * t * t), -0.32 * t * t]
    }), new THREE.Vector3(0, stemLen, -arch));

    return out;
  }

  /* Fallback: the parametric outline, if the artwork cannot be read. */
  const SPLITS = [0.20, 0.35, 0.50, 0.64, 0.77, 0.88];
  const HOLES = [
    [0.24,  0.24, 0.030, 0.068], [0.24, -0.26, 0.028, 0.062],
    [0.36, -0.30, 0.032, 0.072], [0.37,  0.31, 0.029, 0.066],
    [0.49,  0.27, 0.030, 0.070], [0.50, -0.28, 0.027, 0.062],
    [0.62, -0.25, 0.028, 0.064], [0.63,  0.26, 0.026, 0.058],
    [0.74,  0.22, 0.024, 0.052], [0.75, -0.21, 0.022, 0.048]
  ];
  const outline = t => {
    let w = 0.74 * bez(t, 0.04, 1.25, 1.10, 0.02);
    for (let i = 0; i < SPLITS.length; i++) {
      const x = (t - SPLITS[i]) / 0.058;
      if (x > -1 && x < 1) w *= 1 - 0.40 * (0.5 + 0.5 * Math.cos(x * Math.PI));
    }
    return w;
  };
  return plantPart({
    segsT: L(d, 34, 22, 11), segsS: L(d, 26, 18, 8),
    thickness: 0.022,
    width: outline,
    curl:  t => 0.36 + 0.24 * (1 - t),
    droop: t => [t * (1 - 0.12 * t * t), -0.32 * t * t],
    keep: (t, s) => {
      for (const [ht, hs, rt, rs] of HOLES) {
        const dt = (t - ht) / rt, ds = (s - hs) / rs;
        if (dt * dt + ds * ds < 1) return false;
      }
      return !(t < 0.07 && Math.abs(s) < 0.36);
    },
    roll: 0.10
  }, { len: 0.62, arch: 0.20, segs: L(d, 10, 8, 4), radial: L(d, 10, 7, 4), r0: 0.028 });
}

function banana(d) {
  const TEARS = [0.25, 0.40, 0.53, 0.67, 0.79, 0.89];
  return plantPart({
    segsT: L(d, 36, 26, 11), segsS: L(d, 18, 14, 6),
    thickness: 0.016,
    width: t => 0.30 * bez(t, 0.05, 1.32, 1.24, 0.06),
    curl:  t => 1.25 + 0.5 * (1 - t),
    droop: t => [t * (1 - 0.16 * t * t), -0.46 * t * t],
    keep: (t, s) => {
      for (let i = 0; i < TEARS.length; i++) {
        const side = i % 2 ? 1 : -1;
        const depth = 0.34 + ((i * 53) % 40) / 100;
        if (Math.abs(t - TEARS[i]) < 0.030 && Math.sign(s) === side &&
            Math.abs(s) > (1 - depth)) return false;
      }
      return true;
    },
    roll: 0.34
  }, { len: 0.75, arch: 0.26, segs: L(d, 10, 8, 4), radial: L(d, 10, 7, 4), r0: 0.030 });
}

function philo(d) {
  return plantPart({
    segsT: L(d, 34, 24, 9), segsS: L(d, 30, 20, 8),
    thickness: 0.022,
    // broad rounded heart, held wide through the middle and blunt at the tip
    width: t => 0.60 * bez(t, 0.06, 1.34, 1.16, 0.05),
    curl:  t => 0.85 + 0.45 * (1 - t),
    droop: t => [t * (1 - 0.10 * t * t), -0.28 * t * t],
    keep: (t, s) => !(t < 0.10 && Math.abs(s) < 0.44),
    roll: 0.16
  }, { len: 0.70, arch: 0.22, segs: L(d, 10, 8, 4), radial: L(d, 10, 7, 4), r0: 0.026 });
}

/* Compound frond: a rachis carrying paired solid leaflets. */
function fern(d) {
  const out = emptyMesh();
  const N = d ? 11 : 7;
  const len = 1.0, arch = 0.34;
  const path = (u) => new THREE.Vector3(0, u * len, -arch * u * u);

  merge(out, stemTube({
    segs: d ? 12 : 6, radial: d ? 5 : 4,
    radius: u => 0.016 * (1 - u * 0.8), path, uvTop: 1.0
  }), new THREE.Vector3());

  const leaflet = solidBlade({
    segsT: L(d, 8, 6, 3), segsS: L(d, 5, 3, 2),
    thickness: 0.012,
    width: t => 0.32 * bez(t, 0.04, 1.30, 1.18, 0.03),
    curl:  () => 0.55,
    droop: t => [t, -0.16 * t * t]
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    const t = 0.14 + (i / N) * 0.84;
    const size = Math.sin(Math.pow(t, 0.6) * Math.PI * 0.95) * (1 - t * 0.22) * 0.44;
    if (size < 0.03) continue;
    const base = path(t);

    for (const side of [-1, 1]) {
      e.set(-0.30, 0, side * (Math.PI / 2 - (0.42 + t * 0.42)));
      q.setFromEuler(e);
      sc.set(size, size, size);
      m4.compose(base, q, sc);

      const n3 = new THREE.Matrix3().setFromMatrix4(m4).invert().transpose();
      for (let k = 0; k < leaflet.pos.length; k += 3) {
        pv.set(leaflet.pos[k], leaflet.pos[k + 1], leaflet.pos[k + 2]).applyMatrix4(m4);
        out.pos.push(pv.x, pv.y, pv.z);
        pv.set(leaflet.nrm[k], leaflet.nrm[k + 1], leaflet.nrm[k + 2])
          .applyMatrix3(n3).normalize();
        out.nrm.push(pv.x, pv.y, pv.z);
      }
      out.uv.push(...leaflet.uv);
    }
  }
  return out;
}

/* ── public ─────────────────────────────────────────── */

/* ══ SVG outline → leaf profile ═══════════════════════
   Draw a leaf in Illustrator (or any vector tool), export SVG, copy the path's
   `d` attribute, and this turns it into a width profile the solid-blade builder
   can loft. You get a real 3D leaf out of it — cupped, drooping, with wall
   thickness and a rim — not a flat extruded sticker.

   Sampling goes through the browser's own SVGPathElement rather than a
   hand-rolled parser, so every command type and both coordinate conventions
   are handled correctly.

   Only supply artwork you drew or hold a licence for.
   ═══════════════════════════════════════════════════ */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param d        the path's `d` attribute
 * @param slices   how many horizontal bands to measure across the shape
 * @param samples  how many points to walk along the path
 * @returns { width(t), asym(t), aspect }  t = 0 at the base, 1 at the tip
 */
export function profileFromSvgPath(d, { slices = 64, samples = 900 } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.opacity = '0';
  document.body.appendChild(svg);

  let pts;
  try {
    const len = path.getTotalLength();
    if (!len) throw new Error('path has no length');
    pts = [];
    for (let i = 0; i <= samples; i++) {
      const p = path.getPointAtLength((len * i) / samples);
      pts.push([p.x, p.y]);
    }
  } finally {
    svg.remove();
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const midX = (minX + maxX) / 2;

  /* Measure the left and right extent of every horizontal band. SVG y runs
     downward, so the band is flipped to put the leaf's base at t = 0. */
  const left = new Float64Array(slices).fill(0);
  const right = new Float64Array(slices).fill(0);
  for (const [x, y] of pts) {
    const t = 1 - (y - minY) / spanY;
    const k = Math.min(slices - 1, Math.max(0, Math.floor(t * slices)));
    const rel = (x - midX) / spanX;              // -0.5 … 0.5
    if (rel < 0) left[k] = Math.min(left[k], rel);
    else right[k] = Math.max(right[k], rel);
  }

  /* A band the outline never crossed would read as a pinch, so fill gaps by
     carrying the nearest measured value forward. */
  const heal = (arr, sign) => {
    let last = 0;
    for (let i = 0; i < slices; i++) {
      if (arr[i] * sign > 1e-6) last = arr[i];
      else arr[i] = last;
    }
    last = 0;
    for (let i = slices - 1; i >= 0; i--) {
      if (arr[i] * sign > 1e-6) last = arr[i];
      else if (last * sign > 1e-6) arr[i] = last;
    }
  };
  heal(left, -1);
  heal(right, 1);

  const at = (arr, t) => {
    const f = Math.min(slices - 1, Math.max(0, t * (slices - 1)));
    const i = Math.floor(f), j = Math.min(slices - 1, i + 1);
    return arr[i] + (arr[j] - arr[i]) * (f - i);
  };

  return {
    /** half-width at t, normalised so the widest point is 0.5 */
    width: t => (at(right, t) - at(left, t)) / 2,
    /** how far the midrib sits off centre at t, for asymmetric leaves */
    asym: t => (at(right, t) + at(left, t)) / 2,
    aspect: spanY / spanX
  };
}

/**
 * Build one solid leaf from an SVG outline.
 * `cfg` takes the same droop / curl / thickness / stem options as the built-ins.
 */
export function leafFromSvgPath(d, cfg = {}) {
  const prof = profileFromSvgPath(d, cfg.sample);
  const scale = cfg.scale ?? 1.4;
  return finish(plantPart({
    segsT: cfg.segsT ?? 26,
    segsS: cfg.segsS ?? 20,
    thickness: cfg.thickness ?? 0.022,
    width: t => prof.width(t) * scale,
    curl: cfg.curl ?? (t => 0.36 + 0.24 * (1 - t)),
    droop: cfg.droop ?? (t => [t * (1 - 0.12 * t * t), -0.32 * t * t]),
    keep: cfg.keep,
    roll: cfg.roll ?? 0.10
  }, cfg.stem ?? { len: 0.62, arch: 0.20, segs: 8, radial: 7, r0: 0.028 }));
}

/* ══ SVG artwork → leaf mask ═══════════════════════════
   For outlines whose splits and fenestrations are drawn INTO the path (a real
   monstera illustration is one compound path with a dozen-odd interior
   subpaths), a width profile is the wrong tool — it measures only the outer
   extent and fills every notch back in.

   So the path is rasterised to a fill mask instead, and the loft grid asks it
   two questions: how wide is this row, and is this point inside the shape.
   ═══════════════════════════════════════════════════ */

const _maskCache = new Map();

/**
 * @param d    the compound path's `d` attribute
 * @param res  raster resolution; the notch edges can be no finer than this
 * @returns { width(t), inside(t,s), fill }  t = 0 base, 1 tip; s = -1…1 across
 */
export function maskFromSvgPath(d, { res = 512 } = {}) {
  const key = d.length + ':' + res;
  if (_maskCache.has(key)) return _maskCache.get(key);

  const cv = document.createElement('canvas');
  cv.width = cv.height = res;
  const c = cv.getContext('2d', { willReadFrequently: true });

  const p2 = new Path2D(d);

  /* bounds: walk the path once through the browser's own geometry engine */
  const svg = document.createElementNS(SVG_NS, 'svg');
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  svg.appendChild(el);
  svg.style.cssText = 'position:absolute;width:0;height:0;opacity:0';
  document.body.appendChild(svg);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  try {
    const len = el.getTotalLength();
    for (let i = 0; i <= 1200; i++) {
      const q = el.getPointAtLength((len * i) / 1200);
      if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
    }
  } finally { svg.remove(); }

  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const k = Math.min(res / spanX, res / spanY) * 0.98;

  /* Illustrator writes compound paths for nonzero fill, but a mis-wound
     export silently loses every hole — so both rules are tried and the one
     that actually produces holes wins. */
  const rasterise = (rule) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, res, res);
    c.fillStyle = '#fff';
    c.save();
    c.translate((res - spanX * k) / 2 - minX * k, (res - spanY * k) / 2 - minY * k);
    c.scale(k, k);
    c.fill(p2, rule);
    c.restore();
    const px = c.getImageData(0, 0, res, res).data;
    const m = new Uint8Array(res * res);
    let on = 0;
    for (let i = 0, j = 3; i < m.length; i++, j += 4) {
      if (px[j] > 110) { m[i] = 1; on++; }
    }
    return { m, fill: on / m.length };
  };

  let best = rasterise('nonzero');
  const alt = rasterise('evenodd');
  // the rule that carves MORE away from the bounding box is the one with holes
  if (alt.fill < best.fill) best = alt;
  const mask = best.m;

  /* per-row extents, in normalised 0–1 image coordinates */
  const lo = new Float32Array(res).fill(-1);
  const hi = new Float32Array(res).fill(-1);
  for (let row = 0; row < res; row++) {
    const base = row * res;
    let a = -1, b = -1;
    for (let x = 0; x < res; x++) if (mask[base + x]) { a = x; break; }
    for (let x = res - 1; x >= 0; x--) if (mask[base + x]) { b = x; break; }
    lo[row] = a; hi[row] = b;
  }

  // image row 0 is the top of the artwork, so t = 1 there
  const rowAt = t => Math.min(res - 1, Math.max(0, Math.round((1 - t) * (res - 1))));

  const api = {
    fill: best.fill,
    width(t) {
      const r = rowAt(t);
      if (lo[r] < 0) return 0;
      return ((hi[r] - lo[r]) / 2) / res;
    },
    centre(t) {
      const r = rowAt(t);
      if (lo[r] < 0) return 0.5;
      return ((hi[r] + lo[r]) / 2) / res;
    },
    inside(t, s) {
      const r = rowAt(t);
      if (lo[r] < 0) return false;
      const half = (hi[r] - lo[r]) / 2, mid = (hi[r] + lo[r]) / 2;
      const x = Math.round(mid + s * half);
      if (x < 0 || x >= res) return false;
      return !!mask[r * res + x];
    }
  };
  _maskCache.set(key, api);
  return api;
}

const SPECIES = [monstera, banana, philo, fern];
export const LEAF_TYPES = SPECIES.length;

/** @param detail 2 = hero, 1 = near slabs, 0 = far slabs */
export function buildLeafGeometries(detail = 1) {
  return SPECIES.map(fn => finish(fn(detail)));
}
