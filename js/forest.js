/* ══════════════════════════════════════════════════════
   MILKY — night forest + wet glass
   ──────────────────────────────────────────────────────
   Pipeline per frame:

     1  back scene → rtScene
        · lit concrete wall
        · four depth slabs of real 3D foliage
        · two neon strips, anchored to the camera
     2  separable blur of rtScene at quarter res → rtBlur
     3  glass pass: reads the live DOM panel rectangles and
        composites frosted glass inside them, droplets
        refracting back onto the sharp render → screen
     4  foreground fronds over the top

   The leaves are meshes with real normals, lit by the two
   strips as infinite vertical line lights — diffuse,
   specular, rim, and light transmitted through the blade.

   The panel rectangles go to the glass shader in pixels AND
   to the leaf vertex shader in NDC, which is what lets the
   foliage wobble as the panes slide past it.
   ══════════════════════════════════════════════════════ */

import * as THREE from './vendor/three.module.js';
import { buildLeafGeometries, LEAF_TYPES } from './leafgeo.js';

const MAX_PANELS = 10;

/* World units mapped into the 0–1 depth stored in the scene alpha channel.
   Every shader that writes depth, and the strips' uDepth, must agree on this. */
const DEPTH_SCALE = 60;

const NOISE = `
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
               mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

/* Two vertical strip lights, shared by the foliage and the wall.
   Treated as infinite vertical lines: the nearest point is always
   directly beside the surface, which is what a long tube light does. */
const STRIP_LIGHT = `
  /* wrap: 0 = hard Lambert terminator, 1 = fully wrapped.
     Foliage lit hard reads as plastic; wrapping the diffuse term lets light
     bend around the form so leaves sit in a narrow, soft tonal band with no
     visible terminator — which is what makes dim canopy shots look like
     canopy rather than like lit models.
     (No backticks in here — this whole block is a JS template literal.) */
  vec3 stripLight(vec2 stripXZ, vec3 lcol, vec3 N, vec3 P, vec3 V,
                  vec3 albedo, float gloss, float translucency, float wrap){
    vec3 nearest = vec3(stripXZ.x, P.y, stripXZ.y);
    vec3 d = nearest - P;
    float dist = length(d);
    vec3 L = d / max(dist, 0.001);

    // A four-metre tube is a LINE light, not a point — falloff is nearer 1/d
    // than 1/d². Inverse-square here left everything past ~15 units black.
    float atten = 2.4 / (1.0 + dist * 0.17);

    float nl   = dot(N, L);
    float diff = pow(clamp((nl + wrap) / (1.0 + wrap), 0.0, 1.0), 1.0 + wrap);

    // light coming through the back of the blade
    float trans = pow(max(-nl, 0.0), 1.6) * translucency;
    // broad and weak rather than a tight hot highlight
    float spec  = pow(max(dot(reflect(-L, N), V), 0.0), 14.0) * gloss;
    float rim   = pow(1.0 - max(dot(N, V), 0.0), 3.0) * max(nl, 0.0);

    return lcol * atten * (albedo * (diff * 1.15 + trans) + spec * 0.5 + lcol * rim * 0.35);
  }
`;

/* ══ MIST ══════════════════════════════════════════
   Dark cloud sitting between the slabs of planting. Camera-facing quads
   rather than point sprites: gl_PointSize is clamped to 255 on a fair number
   of drivers, and these need to project a couple of hundred pixels across.

   They are drawn dark on purpose. Over foliage the cloud eats it, which is
   what puts distance between the beds; over the empty wall it only lifts
   where a strip is near enough to light it, so the neon reads as sitting
   inside weather rather than in clean air. */
const MIST_VERT = `
  attribute vec3  aPos;
  attribute float aSize;
  attribute float aSeed;

  uniform float uTime;

  varying vec2  vUv;
  varying float vSeed;
  varying vec3  vWorldPos;

  void main(){
    vUv = uv; vSeed = aSeed;

    // each puff on its own slow clock, so the bank never pulses as one
    vec3 c = aPos;
    c.x += sin(uTime * 0.045 + aSeed * 6.283) * 7.0;
    c.y += sin(uTime * 0.031 + aSeed * 12.9) * 2.4;
    vWorldPos = c;

    // billboard by expanding in view space — always square to the camera
    vec4 mv = viewMatrix * vec4(c, 1.0);
    mv.xy += position.xy * aSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const MIST_FRAG = `
  precision highp float;

  uniform vec2  uPoleL;
  uniform vec2  uPoleR;
  uniform vec3  uColL;
  uniform vec3  uColR;
  uniform vec3  uFogColor;
  uniform float uTime;
  uniform float uMist;

  varying vec2  vUv;
  varying float vSeed;
  varying vec3  vWorldPos;

  ${NOISE}

  void main(){
    // round envelope, so the quad never shows a corner
    float body = smoothstep(0.5, 0.05, length(vUv - 0.5));
    if (body <= 0.002) discard;

    // torn into wisps that crawl slowly through themselves
    float w = fbm(vUv * 3.4 + vec2(uTime * 0.012, -uTime * 0.008) + vSeed * 37.0);
    float a = body * smoothstep(0.32, 0.76, w) * uMist;
    if (a <= 0.002) discard;

    float dL = distance(vec3(uPoleL.x, vWorldPos.y, uPoleL.y), vWorldPos);
    float dR = distance(vec3(uPoleR.x, vWorldPos.y, uPoleR.y), vWorldPos);
    vec3 near = mix(uColL, uColR, clamp(dL / max(dL + dR, 0.001), 0.0, 1.0));

    // near-black, plus only as much neon as a cloud that far out would catch
    vec3 col = uFogColor * 0.26 + near * (0.30 / (1.0 + min(dL, dR) * 0.22));

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

/* ══ FOLIAGE ═══════════════════════════════════════ */

const LEAF_VERT = `
  attribute float bend;        // 0 at the crown, 1 at the furthest tip
  attribute float aPhase;
  attribute float aTint;
  attribute float aStiff;
  attribute vec2  aNeighborPush;

  uniform float uTime;
  uniform float uSway;
  uniform float uScrollVel;
  uniform float uRubber;
  uniform vec2  uMouse;
  uniform float uProjScale;     // tan(fov/2)
  uniform float uAspect;
  uniform int   uAvoidCount;
  uniform vec4  uAvoidNdc[${MAX_PANELS}];   // content collision fields in NDC

  varying vec3  vNormalW;
  varying vec3  vWorldPos;
  varying vec2  vUv;
  varying float vTint;
  varying float vDepth;
  varying float vStem;

  float sdBox(vec2 p, vec2 b){
    vec2 q = abs(p) - b;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
  }

  void main(){
    vUv   = uv;
    vTint = aTint;

    // everything bends from the crown; the petiole barely moves, the tip does
    float stem = bend;
    vStem = stem;

    // where the instance sits on screen before anything moves it
    vec4 originWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 originClip  = projectionMatrix * viewMatrix * originWorld;
    vec2 ndc = originClip.xy / max(originClip.w, 0.0001);

    /* ── local bend: wind, and the drag of the camera moving ── */
    vec3 p = position;
    float wind = sin(uTime * 0.62 + aPhase) * 0.55
               + sin(uTime * 0.24 + aPhase * 2.1) * 0.30;
    float cantilever = stem * stem;          // tips travel, stems don't
    /* Give every blade a real bow instead of leaving the rosette as a stack of
       flat cards. The middle rises toward the camera and the tip relaxes down;
       instance rotation then turns that same curve into different silhouettes. */
    float arch = sin(clamp(stem, 0.0, 1.0) * 3.14159265);
    p.z += arch * (0.115 + 0.035 * sin(aPhase));
    p.y -= cantilever * 0.035;
    p.x += (wind * uSway - uScrollVel * 1.5) * cantilever * 0.30;
    p.z += cos(uTime * 0.47 + aPhase * 1.3) * uSway * cantilever * 0.14;

    vec4 world = instanceMatrix * vec4(p, 1.0);

    /* Project the actual blade vertex, not only the plant crown. A single
       monstera can cover half a viewport while its crown remains outside a
       content block; sampling the surface is what lets the pane genuinely
       brush and bend the leaf that visually overlaps it. */
    vec4 vertexClip = projectionMatrix * viewMatrix * world;
    vec2 vertexNdc = vertexClip.xy / max(vertexClip.w, 0.0001);

    /* ── solid-panel contact ──
       Only rectangles supplied as genuinely opaque surfaces enter this loop.
       Contact is resolved once per specimen, then distributed from the fixed
       stem foot upward so the petiole takes most of the bend and the blade only
       carries a smaller continuation of that flex. */
    vec2 shove = vec2(0.0);
    for (int i = 0; i < ${MAX_PANELS}; i++){
      if (i >= uAvoidCount) break;
      vec4 pn = uAvoidNdc[i];
      if (pn.z <= 0.0) continue;

      vec2 pointRel = vertexNdc - pn.xy;
      vec2 rootRel  = ndc - pn.xy;
      float sd = sdBox(pointRel, pn.zw);         // <0 on the solid surface
      float rootSd = sdBox(rootRel, pn.zw + vec2(0.08));
      float vertexContact = smoothstep(0.045, -0.025, sd);
      float rootContact = smoothstep(0.060, -0.040, rootSd);
      float contact = max(rootContact, vertexContact * 0.70);
      float inside  = smoothstep(0.025, -0.10, sd);

      /* The whole leaf chooses a side from its crown, but pressure is sampled
         per vertex. That makes it lean as one plant instead of tearing down
         the middle when the panel crosses its blade. */
      vec2 dir = normalize(rootRel + vec2(sin(aPhase) * 0.035,
                                          cos(aPhase) * 0.018));
      float pressure = contact * (0.085 + inside * 0.24);
      shove += dir * pressure;
    }
    shove *= uRubber * aStiff;
    float shoveLen = length(shove);
    if (shoveLen > 0.28) shove *= 0.28 / shoveLen;

    /* the cursor parts the leaves too */
    vec2 toMouse = ndc - uMouse;
    float mInfl = smoothstep(0.60, 0.0, length(toMouse));
    vec2 cursorShove = normalize(toMouse + vec2(0.0001)) * mInfl * 0.10 * aStiff;

    // NDC displacement → world units at this leaf's depth. The exponential
    // bend curve is exactly zero at the planted stem foot, gains most of its
    // travel through the petiole, then adds only a little more across the leaf.
    float zdist = max(-(viewMatrix * world).z, 0.001);
    float anchoredFlex = 1.0 - exp(-4.5 * stem);
    /* Canopies yield slightly away from nearby plants. This is stored per
       specimen rather than solved by moving the root: at bend == 0 the
       multiplier is exactly zero, so every stem foot remains planted. */
    float contactPulse = 0.82 + 0.18 * sin(uTime * 0.38 + aPhase);
    world.x += aNeighborPush.x * anchoredFlex * uRubber * contactPulse;
    world.y += aNeighborPush.y * anchoredFlex * uRubber * contactPulse;
    world.x += (shove.x * anchoredFlex + cursorShove.x * anchoredFlex)
             * uProjScale * uAspect * zdist;
    world.y += (shove.y * anchoredFlex + cursorShove.y * anchoredFlex)
             * uProjScale * zdist;

    vWorldPos = world.xyz;
    vNormalW  = normalize(mat3(instanceMatrix) * normal);

    vec4 mv = viewMatrix * world;
    vDepth  = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const LEAF_FRAG = `
  uniform vec2  uPoleL;        // world x,z of each strip
  uniform vec2  uPoleR;
  uniform vec3  uColL;
  uniform vec3  uColR;
  uniform vec3  uFogColor;
  uniform float uFogDensity;
  uniform vec2  uRes;
  uniform float uStripOnLeaf;  // how hard the neon lights foliage
  uniform float uGreenGlow;    // green transmission near the strips, up front
  uniform float uWetLeaf;      // 0 = dry and matte, 1 = soaked and glossy
  uniform float uVeinGlow;     // how hard the midrib and veins catch the light
  uniform float uDepthContrast;// gamma at full depth; > 1 crushes the shadows
  uniform float uStemFade;     // how dark the petiole goes at the crown
  uniform float uTipLight;     // dull pool of light landing on the blade tip
  uniform float uLeafSpot;     // per-blade spot on the upper, camera-facing face
  uniform float uLeafDark;     // blade body multiplier; 1.0 = the old value
  uniform vec3  uLeafCool;     // what the shadowed half is tinted toward
  uniform vec3  uLeafWarm;     // what the lit half is tinted toward
  uniform float uSplitGain;    // turns spotlight strength into a 0-1 key
  uniform float uEdgeSoft;     // how far the silhouette falls away at the rim
  uniform float uLeafGloss;    // broad waxy sheen across the whole face
  uniform float uRimPink;      // magenta edge light
  uniform float uWetTop;       // standing water on the upward-facing surfaces
  uniform float uLeafWrap;     // 0 = hard terminator, 1 = fully wrapped
  uniform float uAmbient;      // strength of the hemisphere fill
  uniform float uFrontSpot;    // wet photographic key light on the near canopy
  uniform vec3  uSpotPos;      // camera-following lamp position in world space
  uniform float uPanelDim;     // 1.0 = untouched; < 1 dims over the panes
  uniform int   uPanelCount;
  uniform vec4  uPanelsNdc[${MAX_PANELS}];

  varying vec3  vNormalW;
  varying vec3  vWorldPos;
  varying vec2  vUv;
  varying float vTint;
  varying float vDepth;
  varying float vStem;

  ${NOISE}
  ${STRIP_LIGHT}

  float sdBoxF(vec2 p, vec2 b){
    vec2 q = abs(p) - b;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
  }

  void main(){
    vec3 N = normalize(vNormalW);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vWorldPos);

    /* ── surface detail ── */
    float s = vUv.x * 2.0 - 1.0;
    float midrib = smoothstep(0.05, 0.0, abs(s));
    // laterals sweep out from the midrib toward the tip
    float lat = sin(vUv.y * 52.0 - abs(s) * 8.0);
    float veins = smoothstep(0.88, 1.0, lat)
                * (1.0 - midrib)
                * (1.0 - smoothstep(0.84, 1.0, abs(s)));

    /* Petrol blue-green is the body colour. Selected plants only borrow a
       trace of wine for warmth; the pink/orange arrives as quiet, flowing
       variegation instead of turning the whole specimen magenta. */
    float variegatedPlant = smoothstep(0.50, 0.82, vTint);
    float magentaPlant = variegatedPlant * 0.12;
    vec3 tealDark = vec3(0.006, 0.028, 0.040);
    vec3 tealMid  = vec3(0.018, 0.205, 0.235);
    vec3 wineDark = vec3(0.030, 0.004, 0.025);
    vec3 wineMid  = vec3(0.420, 0.008, 0.160);
    vec3 dark = mix(tealDark, wineDark, magentaPlant);
    vec3 mid  = mix(tealMid,  wineMid,  magentaPlant);
    vec3 albedo = mix(dark, mid, 0.35 + 0.65 * vStem);
    albedo *= 1.0 - veins * 0.30;          // vein tissue is darker in diffuse

    // Wide, quiet tonal variation keeps a wet face from reading as flat CG.
    float tissue = fbm(vUv * vec2(4.2, 7.5) + vTint * 17.0);
    albedo *= 0.84 + tissue * 0.30;

    float stripeFlow = sin(vUv.y * 15.0 + s * 5.4 + tissue * 3.2 + vTint * 7.0);
    float stripe = smoothstep(0.58, 0.94, stripeFlow)
                 * smoothstep(0.08, 0.26, vUv.y)
                 * (1.0 - smoothstep(0.66, 0.98, abs(s)))
                 * variegatedPlant;
    vec3 stripeTint = mix(vec3(0.50, 0.020, 0.18), vec3(0.82, 0.15, 0.045),
                          0.5 + 0.5 * sin(vUv.y * 4.2 + vTint * 11.0));
    albedo = mix(albedo, albedo + stripeTint * 0.20, stripe * 0.34);

    /* ── lighting ──
       A broad hemisphere does most of the work — cool sky above, a dimmer
       warmer bounce below. Making the fill dominant rather than the strips is
       what keeps the canopy inside a narrow tonal band instead of carving it
       into lit and unlit halves. Downward-facing surfaces still get far less,
       so undersides and the shaded half of every cupped blade fall away. */
    float up = 0.5 + 0.5 * N.y;
    vec3 sky    = mix(vec3(0.24, 0.58, 0.82), vec3(0.72, 0.24, 0.52), magentaPlant);
    vec3 ground = mix(vec3(0.08, 0.15, 0.22), vec3(0.18, 0.05, 0.15), magentaPlant);
    vec3 col = albedo * mix(ground, sky, up) * uAmbient;
    if (!gl_FrontFacing) col *= 0.34;         // the underside of the blade

    /* A broad photographic key sits just in front of the camera and follows it
       down the page. It only reaches the near canopy: the front faces receive
       a soft pool and the water film receives two much brighter reflections.
       This is what makes a few leaves look caught in a spotlight while the
       rest of the forest can disappear into black. */
    vec3 keyDelta = uSpotPos - vWorldPos;
    float keyDist = length(keyDelta);
    vec3 keyL = keyDelta / max(keyDist, 0.001);
    vec3 keyRay = normalize(vWorldPos - uSpotPos);
    vec3 keyAxis = normalize(vec3(-0.10, -0.07, -1.0));
    float keyCone = smoothstep(0.46, 0.90, dot(keyRay, keyAxis));
    float keyDepth = 1.0 - smoothstep(9.0, 27.0, vDepth);
    float keyFacing = max(dot(N, keyL), 0.0);
    float keyAtt = keyCone * keyDepth * (3.2 / (1.0 + keyDist * 0.085));
    vec3 keyCol = mix(vec3(0.56, 0.88, 0.90),
                      vec3(1.00, 0.46, 0.72), magentaPlant);

    col += albedo * keyCol * (0.12 + 0.88 * keyFacing)
         * keyAtt * uFrontSpot * 2.2;

    float keyRefl = max(dot(reflect(-keyL, N), V), 0.0);
    float keyBroad = pow(keyRefl, 22.0);
    float keyPin = pow(keyRefl, 130.0);
    col += keyCol * (keyBroad * 0.82 + keyPin * 3.8)
         * keyAtt * uFrontSpot * uWetLeaf;

    // Strongly wrapped and near-matte: the strips wash the canopy rather than
    // carving it. Gloss stays low so no leaf picks up a hot specular.
    col += (stripLight(uPoleL, uColL, N, vWorldPos, V, albedo, 0.16, 0.55, uLeafWrap)
          + stripLight(uPoleR, uColR, N, vWorldPos, V, albedo, 0.16, 0.55, uLeafWrap))
          * uStripOnLeaf;

    /* ── rib catch ──
       The one cue every reference photograph shares: the midrib and the
       laterals are the brightest thing on the blade, taking the colour of
       whatever light is nearest — violet, amber, green off a neon frame. The
       face stays almost black and the ribs draw the leaf. */
    if (uVeinGlow > 0.001) {
      float dL = distance(vec3(uPoleL.x, vWorldPos.y, uPoleL.y), vWorldPos);
      float dR = distance(vec3(uPoleR.x, vWorldPos.y, uPoleR.y), vWorldPos);
      vec3 near = mix(uColL, uColR, clamp(dL / max(dL + dR, 0.001), 0.0, 1.0));
      /* In every reference the midrib and laterals are PALE — cream, or a
         washed-out yellow-green — not the colour of whatever neon is nearest.
         The strip only tints them. */
      near = mix(vec3(0.82, 0.96, 0.83), near, 0.18);
      float reach = 2.2 / (1.0 + min(dL, dR) * 0.20);
      // ribs read hardest where the blade turns away from the eye
      float turn = 0.45 + 0.55 * pow(1.0 - max(dot(N, V), 0.0), 1.5);
      float rib = midrib * 1.0 + veins * 0.45;
      col += near * rib * reach * turn * uVeinGlow;
    }

    /* ── green transmission ──
       A leaf close to a strip and close to the camera glows green as light
       passes through the blade. Strongest at grazing angles, which is where
       you actually see it in a real canopy. */
    float dL = distance(vec3(uPoleL.x, vWorldPos.y, uPoleL.y), vWorldPos);
    float dR = distance(vec3(uPoleR.x, vWorldPos.y, uPoleR.y), vWorldPos);
    float nearStrip = 1.0 / (1.0 + min(dL, dR) * 0.16);
    float nearCam   = smoothstep(26.0, 3.0, vDepth);
    float grazing   = pow(1.0 - max(dot(N, V), 0.0), 1.6);
    vec3 transmission = mix(vec3(0.06, 0.62, 0.56),
                            vec3(0.86, 0.06, 0.40), magentaPlant);
    col += transmission
         * nearStrip * nearCam * (0.32 + 0.68 * grazing)
         * (0.35 + 0.65 * vStem)
         * uGreenGlow;

    /* ── wet surface ──
       A soaked leaf is not just glossier: it holds a tight mirror highlight
       from each strip and a broad fresnel sheen where the surface turns away.
       Kept as a separate lobe from the matte diffuse so the canopy keeps its
       soft body and only the sheen reads as water. */
    if (uWetLeaf > 0.001) {
      vec3 sheen = vec3(0.0);
      for (int k = 0; k < 2; k++) {
        vec2 sp = (k == 0) ? uPoleL : uPoleR;
        vec3 lc = (k == 0) ? uColL : uColR;
        vec3 near = vec3(sp.x, vWorldPos.y, sp.y);
        vec3 Ld = near - vWorldPos;
        float dist = length(Ld);
        vec3 Lw = Ld / max(dist, 0.001);
        float at = 2.4 / (1.0 + dist * 0.17);
        // tight lobe = wet; the dry material uses exponent 14
        float hi = pow(max(dot(reflect(-Lw, N), V), 0.0), 110.0);
        sheen += lc * at * hi * 2.2;
      }
      // water films the whole blade, so the rim lifts even away from a strip
      float fres = pow(1.0 - max(dot(N, V), 0.0), 4.5);
      sheen += vec3(0.36, 0.62, 0.72) * fres * 0.5;

      /* The thing that reads as "wet" in the references is not the pin
         highlights — it is a broad sheen lying across the entire blade, the
         dome overhead reflected in a waxy surface. Wide lobe, low exponent,
         so it covers the face instead of picking out one spot. */
      vec3 Rv = reflect(-V, N);
      float dome = pow(clamp(0.5 + 0.5 * Rv.y, 0.0, 1.0), 2.2);
      vec3 sheenLow = mix(vec3(0.04, 0.12, 0.17), vec3(0.15, 0.03, 0.12), magentaPlant);
      vec3 sheenHigh = mix(vec3(0.16, 0.48, 0.54), vec3(0.62, 0.12, 0.40), magentaPlant);
      sheen += mix(sheenLow, sheenHigh, dome)
             * dome * uLeafGloss;

      col += sheen * uWetLeaf;
    }

    /* ── standing water on top ──
       Rain does not film a blade evenly. It runs off the undersides and pools
       on whatever faces up, and those pools mirror the dome overhead rather
       than the strips beside them. Weighted by N.y so the undersides stay dry,
       and broken by a noise field so it reads as water lying on the leaf and
       not as a polished material. */
    if (uWetTop > 0.001) {
      float faceUp = smoothstep(0.02, 0.62, N.y);
      float pooled = smoothstep(0.38, 0.74, fbm(vUv * vec2(9.0, 13.0) + vTint * 17.0));
      float wet    = faceUp * pooled;

      // what a puddle can see: cool dome above, murk below
      vec3 R = reflect(-V, N);
      vec3 mirrored = mix(uFogColor * 1.5, vec3(0.30, 0.60, 0.76), 0.5 + 0.5 * R.y);
      float graze = 0.20 + 0.80 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
      col += mirrored * wet * graze * uWetTop;

      /* and the neon glints off it. A far tighter lobe than the leaf's own —
         water is a mirror where wax is only glossy, so this reads as a hard
         bright fleck sitting on the surface rather than a sheen in it. */
      for (int k = 0; k < 2; k++) {
        vec2 sp = (k == 0) ? uPoleL : uPoleR;
        vec3 lc = (k == 0) ? uColL : uColR;
        vec3 sq = vec3(sp.x, vWorldPos.y, sp.y);
        vec3 Lw = normalize(sq - vWorldPos);
        float dw = distance(sq, vWorldPos);
        float g  = pow(max(dot(reflect(-Lw, N), V), 0.0), 260.0);
        col += lc * g * (2.4 / (1.0 + dw * 0.17)) * wet * 3.4 * uWetTop;
      }
    }

    /* ── a dull pool of light at the tip ──
       A blade is not lit evenly along its length: the far end sits in a soft
       low-contrast pool while the base falls away into the plant. Broad and
       pulled most of the way to neutral on purpose — saturated and tight, it
       would read as a specular highlight instead of as light landing on a
       leaf. Paired with the stem fade below, this is the whole gradient. */
    vec3 tipPool = vec3(0.0);
    if (uTipLight > 0.001) {
      vec3 lamp = mix(uColL, uColR, clamp(dL / max(dL + dR, 0.001), 0.0, 1.0));
      vec3 pool = mix(lamp, vec3(0.62, 0.72, 0.74), 0.62);   // dull, not neon
      float along  = smoothstep(0.44, 1.0, vStem);
      float across = 1.0 - smoothstep(0.30, 1.0, abs(s));
      float face   = 0.40 + 0.60 * max(dot(N, V), 0.0);

      /* Falls off with camera distance the way a line light does, 1/(1+d),
         not exponentially. Added into the fog it recedes like everything
         else; the same mistake as the inverse-square strips, and it left the
         pool visible only on the hero frond. */
      float reach = 1.0 / (1.0 + vDepth * 0.055);
      tipPool = pool * along * along * (0.30 + 0.70 * across) * face
              * nearStrip * reach * uTipLight;
    }

    /* ── a spot on each blade ──
       Where the tip pool is one light at one end, this picks out the whole
       upper, camera-facing face of every leaf — so the blades separate from
       each other instead of massing into one dark shape. It is keyed off the
       surface normal, not off a light position, which is what makes it land
       on every leaf individually however the plant is turned: a blade tilted
       away gets nothing, one presenting its top to you gets the full pool.

       Deliberately not a specular. Broad exponents and a desaturated tint, so
       it reads as light lying on the leaf rather than a gloss highlight — the
       wet lobe above is already doing gloss. */
    vec3 leafSpot = vec3(0.0);
    if (uLeafSpot > 0.001) {
      /* "Faces up" and "faces a camera looking level" are close to mutually
         exclusive: a blade presenting its top to you has N.y near zero, so
         gating on smoothstep(N.y) multiplied the whole term away — it measured
         0.00% of the frame. Up is a bias now, never a gate. */
      /* The floor is what matters here, not the exponent. An earlier note
         blamed the facing test for this term reaching only 0.5% of leaf
         pixels; measuring the rim later showed dot(N,V) is around 0.9 across
         most of a blade, so the facing test was never the problem — the
         smoothstep(N.y) gate above was. The floor is kept because a blade
         turned away should still catch some of the pool. */
      float front = 0.20 + 0.80 * pow(max(dot(N, V), 0.0), 0.8);
      float up    = 0.35 + 0.65 * smoothstep(-0.35, 0.55, N.y);
      // tight enough across and along the blade to be a pool, not a wash
      float acr   = 1.0 - smoothstep(0.05, 0.95, abs(s));
      float aln   = smoothstep(0.05, 0.55, vStem);
      float reach2 = 1.0 / (1.0 + vDepth * 0.050);

      vec3 lamp2 = mix(uColL, uColR, clamp(dL / max(dL + dR, 0.001), 0.0, 1.0));
      // Cyan on teal specimens, pink on wine specimens; never a lime wash.
      vec3 specimen = mix(vec3(0.20, 0.70, 0.64),
                          vec3(0.88, 0.13, 0.47), magentaPlant);
      vec3 tint  = mix(specimen, lamp2, 0.18);
      leafSpot = tint * up * front * acr * aln * reach2 * uLeafSpot;
    }

    /* ── the silhouette falls away at the rim ──
       A solid leaf ends on a wall of geometry one pixel wide, which cuts hard
       against whatever is behind it. At the rim that wall turns edge-on to
       the eye, so grazing angle is a free edge detector — dropping the value
       there lets the outline round off into the dark instead of stopping. */
    float edge = pow(1.0 - max(dot(N, V), 0.0), 7.0);
    col *= mix(1.0, 0.42, edge * uEdgeSoft);

    /* Almost every reference plate rims its leaves in magenta where they turn
       away.

       OFF BY DEFAULT, and worth knowing why before turning it up. A view-angle
       rim cannot be isolated on this foliage: 1 - dot(N,V) measured uniformly
       high right across the blade, so every threshold tried — powers of 3.2
       and 1.6, and smoothsteps at 0.12-0.55 and 0.46-0.84 — either vanished
       to 0.02% of the frame or covered 99.7% of every leaf and washed the
       whole canopy pink. There is no band in between to aim at.

       The magenta in the reference plates comes off the neon rather than out
       of the surface anyway, so uStripOnLeaf carries it instead. This stays a
       manual knob (setRimPink) for when a flat tint is wanted. */
    float rimP = smoothstep(0.46, 0.84, 1.0 - max(dot(N, V), 0.0));
    col += vec3(0.62, 0.09, 0.34) * rimP * uRimPink;

    /* ── the blade sits a step darker ──
       Applied to the finished body rather than to the albedo. Scaling the
       albedo turned out to be nearly a no-op — measured 74.3 to 74.0 mean
       leaf luminance for a 20% cut — because almost none of a leaf's final
       value comes from diffuse: it is the strip wash, the ribs, the green
       transmission and the wet lobes stacked on top. Those are what has to
       come down for the canopy to read darker.

       The tip pool and the per-blade spot are added AFTER the fog below, so
       they deliberately escape this — which is the point. The body drops, the
       pools do not, and each leaf reads as picked out rather than washed. */
    col *= uLeafDark;

    /* ── fog ── */
    float f = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

    /* ── depth falloff: a spotlight, not a dimmer ──
       No flat multiply. A lit face keeps its value at any distance; only the
       shaded side of a leaf falls away, and it falls faster the further back
       it sits. The canopy then reads as picked out of the dark by the strips
       rather than uniformly turned down.

       Applied after the fog deliberately — before it, the fog term already
       dominates at distance and drags everything back to the same haze. */
    float far = smoothstep(4.0, 30.0, vDepth);
    col = pow(max(col, 0.0), vec3(mix(1.0, uDepthContrast, far)));

    /* The tip pool lands here rather than up with the rest of the lighting.
       Mixed in before the fog it was gone by twenty units — measured at 1.25%
       of the frame mid-page, where the canopy had otherwise dissolved into
       haze entirely. This is the light picking the blade tips back out of it. */
    /* Pools used to survive behind the fog and flatten every slab into one
       illuminated wallpaper. Restrict them to the front half of the forest so
       the rear foliage becomes silhouette and then true black fog. */
    float poolDepth = 1.0 - smoothstep(10.0, 28.0, vDepth);
    vec3 pools = (tipPool + leafSpot) * mix(0.035, 1.0, poolDepth);
    col += pools;

    /* ── green in the spotlight, blue out of it ──
       Keyed on the spotlight itself, not on the pixel's luminance. Luminance
       looked like the obvious choice and was measurably the wrong one: across
       the blade it spans a narrow band, so the darkest and lightest thirds
       came back at key 0.60 and 0.79 — a fifth of the curve between them, and
       no amount of tinting could pull a split out of that.

       The pools ARE the spotlight, so their own strength is the honest key: a
       pixel in the pool goes green, one the pool never reached goes blue, and
       the transition follows the light rather than the exposure. */
    float key = clamp(dot(pools, vec3(0.2126, 0.7152, 0.0722)) * uSplitGain, 0.0, 1.0);
    vec3 coolTone = mix(uLeafCool, vec3(1.28, 0.52, 1.08), magentaPlant);
    vec3 warmTone = mix(uLeafWarm, vec3(1.34, 0.72, 1.02), magentaPlant);
    col *= mix(coolTone, warmTone, key);

    /* ── the petiole falls into shadow at the crown ──
       A stem lit evenly along its length reads as a stick floating in space.
       Real ones disappear into the mass of the plant, so drive it toward
       black at bend 0 and let it come up as the blade begins. */
    /* A smoothstep put the whole fade on the petiole, which is a few pixels
       wide — measured an 8.6% mean drop, nothing like a fade to black. The
       gradient wants to run the length of the blade, so the ramp is a slow
       power curve instead: still black where the stem meets the crown, still
       full value at the tip, but the inner half of the blade now sits in
       shadow the way it does in the reference photographs. */
    col *= mix(uStemFade, 1.0, pow(clamp(vStem, 0.0, 1.0), 1.5));

    /* Foreground fronds are drawn after the glass, so they cross in front of
       the panes — which also means a neon-lit leaf can land on top of body
       text where no CSS can rescue its contrast. Dim them over a pane only. */
    if (uPanelDim < 0.999){
      vec2 fndc = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
      float ins = 0.0;
      for (int i = 0; i < ${MAX_PANELS}; i++){
        if (i >= uPanelCount) break;
        vec4 pn = uPanelsNdc[i];
        if (pn.z <= 0.0) continue;
        ins = max(ins, smoothstep(0.005, -0.005, sdBoxF(fndc - pn.xy, pn.zw)));
      }
      col *= mix(1.0, uPanelDim, ins);
    }

    // alpha carries linear depth for the depth-of-field pass
    gl_FragColor = vec4(col, clamp(vDepth / ${DEPTH_SCALE}.0, 0.0, 1.0));
  }
`;

/* ══ WALL ══════════════════════════════════════════ */

const WALL_VERT = `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vDepth;
  void main(){
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const WALL_FRAG = `
  uniform vec2  uPoleL;
  uniform vec2  uPoleR;
  uniform vec3  uColL;
  uniform vec3  uColR;
  uniform vec3  uFogColor;
  uniform float uFogDensity;
  uniform float uDepthDim;

  varying vec3  vWorldPos;
  varying vec2  vUv;
  varying float vDepth;

  ${NOISE}
  ${STRIP_LIGHT}

  void main(){
    vec2 p = vWorldPos.xy * 0.055;

    // pitted render, coarse and fine
    float coarse = fbm(p * 0.7);
    float fine   = fbm(p * 5.5);
    float pit    = smoothstep(0.62, 0.95, fbm(p * 12.0));

    // hairline cracks — ridged noise thresholded hard
    float cr = abs(fbm(p * 1.35) - 0.5) * 2.0;
    float crack = 1.0 - smoothstep(0.0, 0.055, cr);
    float crack2 = 1.0 - smoothstep(0.0, 0.030, abs(fbm(p * 2.6 + 31.0) - 0.5) * 2.0);
    crack = clamp(crack + crack2 * 0.7, 0.0, 1.0);

    vec3 albedo = vec3(0.150, 0.252, 0.325);
    albedo *= 0.68 + 0.55 * coarse;
    albedo *= 1.0 - fine * 0.22;
    albedo *= 1.0 - pit * 0.30;
    albedo *= 1.0 - crack * 0.72;                 // cracks read as dark seams

    // bumpy normal so the strips graze across the render
    float e = 0.35;
    float hx = fbm(p + vec2(e, 0.0)) - fbm(p - vec2(e, 0.0));
    float hy = fbm(p + vec2(0.0, e)) - fbm(p - vec2(0.0, e));
    vec3 N = normalize(vec3(-hx * 1.6, -hy * 1.6, 1.0));
    vec3 V = normalize(cameraPosition - vWorldPos);

    // the wall is the brightest large surface — foliage silhouettes against it
    vec3 col = albedo * vec3(0.60, 0.84, 1.00);
    col += stripLight(uPoleL, uColL, N, vWorldPos, V, albedo, 0.10, 0.0, 0.30);
    col += stripLight(uPoleR, uColR, N, vWorldPos, V, albedo, 0.10, 0.0, 0.30);

    float f = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

    /* The wall takes the same falloff at roughly half strength. At full it
       goes so dark that once the near foliage scrolls past there is nothing
       left to see — average frame value fell from 24 to 8 down the page. */
    col *= mix(1.0, mix(uDepthDim, 1.0, 0.5), smoothstep(4.0, 30.0, vDepth));

    gl_FragColor = vec4(col, clamp(vDepth / ${DEPTH_SCALE}.0, 0.0, 1.0));
  }
`;

/* ══ NEON STRIP ════════════════════════════════════ */

const POLE_FRAG = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uDepth;      // the strip's own normalised depth
  varying vec2 vUv;
  ${NOISE}
  void main(){
    float d    = abs(vUv.x - 0.5) * 2.0;
    float core = smoothstep(0.072, 0.0, d);     // hot electrical filament, wide enough to read at screen scale
    float tube = smoothstep(0.175, 0.018, d);   // saturated light held in the glass
    float halo = exp(-d * 4.7);                 // broader bloom falling into the fog
    float flick = 0.965 + 0.035 * sin(uTime * 7.3 + hash21(vec2(floor(uTime * 8.0), 1.0)) * 6.0);
    float ends = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);

    // Colour is already premultiplied by its own falloff, so this blends
    // additively with a factor of One rather than SrcAlpha.
      vec3 hot = mix(uColor, vec3(1.0), 0.34);
      vec3 c = (hot * core * 7.25 + uColor * (tube * 3.05 + halo * 1.35)) * flick * ends;

    // Alpha carries depth, and the material blends alpha with MIN. Where the
    // strip is bright it stamps its own (near) depth over whatever is behind,
    // so the DOF pass keeps it sharp instead of blurring it to the wall's
    // distance. Where it is dim it writes 1.0 and loses the min.
    float lit = (core + tube * 0.62 + halo * 0.30) * ends;
    gl_FragColor = vec4(c, mix(1.0, uDepth, smoothstep(0.12, 0.55, lit)));
  }
`;

/* ══ BLUR ══════════════════════════════════════════ */

const BLUR_FRAG = `
  uniform sampler2D tSrc;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;
    s += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    s += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(s, 1.0);
  }
`;

/* ══ WET GLASS ═════════════════════════════════════ */

const GLASS_FRAG = `
  uniform sampler2D tScene;      // rgb = colour, a = linear depth
  uniform sampler2D tL1;         // 1/2  — barely soft
  uniform sampler2D tL2;         // 1/4
  uniform sampler2D tL3;         // 1/8
  uniform sampler2D tL4;         // 1/16
  uniform sampler2D tL5;         // 1/32 — the far haze
  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uGravity;
  uniform int   uCount;
  uniform vec4  uPanels[${MAX_PANELS}];
  uniform float uRadius[${MAX_PANELS}];
  uniform float uWet;
  uniform float uDropScale;    // pixels per droplet unit — one size everywhere
  uniform float uWetGain;      // how hard the water reads; 1.0 = the old look
  uniform float uPanelOpacity;   // 1 = solid matte, lower = see more forest
  uniform float uRimStrength;    // the lit edge around each pane
  uniform float uFocus;          // normalised depth held in focus
  uniform float uDofRange;       // how quickly it falls out of focus
  uniform float uTiltAmt;        // tilt-shift strength (0 = off)
  uniform float uTiltCenter;     // screen height of the sharp band
  uniform float uTiltBand;       // half-height of the sharp band
  uniform float uTiltSoft;       // how fast it falls off above and below
  uniform float uExposure;

  varying vec2 vUv;
  ${NOISE}

  float sdRoundRect(vec2 p, vec2 b, float r){
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  /* ── droplets ──────────────────────────────────────────
     Water on a vertical pane is mostly *still*. Beads pin
     themselves by surface tension and sit there; only once
     a drop gathers enough mass does it break loose and run,
     clearing a track through the beads it passes.

     So: a static field that has no time term at all, plus a
     handful of runners on long random periods.

     Returns  .xy surface normal   .z bead height   .w wet trail
     ─────────────────────────────────────────────────────── */

  /* Static beads. Nothing here depends on time — these never move. */
  vec4 beadField(vec2 uv, float scale, float seed){
    vec2 st = uv * scale + seed * 11.3;
    vec2 id = floor(st);
    vec2 f  = fract(st) - 0.5;

    float n = hash21(id + seed);
    if (n < 0.84) return vec4(0.0);                 // sparse, quiet condensation

    vec2  off = (vec2(hash21(id + 1.7), hash21(id + 3.3)) - 0.5) * 0.66;
    /* The floor used to sit at 0.17 of a cell, which on a short pane came out
       around two pixels — too small to read as a drop, so it just added noise.
       Raised so the smallest bead is still a bead. */
    float r   = 0.30 + 0.16 * hash21(id + 5.1);
    vec2  d   = f - off;
    float dd  = length(d) / r;
    if (dd > 1.12) return vec4(0.0);

    // spherical cap: height falls off as sqrt(1 - r²), which is what gives
    // a real bead its fat centre and its sharply-turned rim
    float soft = 1.0 - smoothstep(0.94, 1.12, dd);
    float h = sqrt(max(0.0, 1.0 - min(dd, 1.0) * min(dd, 1.0)));
    return vec4((-d / r) * soft, max(h * soft, 0.028 * soft), 0.0);
  }

  /* A rare runner. Each column gets its own long period, so at any moment
     only one or two are actually moving anywhere on the pane. */
  vec4 runner(vec2 uv, float t, float cols, float seed, float span){
    float cx = floor(uv.x * cols + seed * 3.7);
    float n  = hash21(vec2(cx, seed * 19.0));
    if (n < 0.965) return vec4(0.0);                // runners are exceptional

    float period = 11.0 + n * 27.0;                 // seconds between runs
    // NOTE: runners are genuinely rare — expect one every ~30s somewhere on
    // the pane. Short test windows will miss them entirely.
    float ph = fract((t + n * 57.0) / period);
    float win = 0.217;                              // fraction spent in motion (~20% quicker)
    if (ph > win) return vec4(0.0);

    float k = ph / win;
    float travel = k * k * 0.62 + k * 0.38;         // accelerates as it falls
    /* The seed offset has to come back out here. Without it the head was
       placed a whole seed*3.7/cols away from the column that selected it, so
       no fragment was ever both inside the head AND in its column — the
       second runner layer drew nothing at all, silently, for its whole life. */
    float xc = (cx + 0.5 + (hash21(vec2(cx, 7.0)) - 0.5) * 0.6 - seed * 3.7) / cols;
    // the pane spans +-span*0.5 about 0.5, so the fall has to be scaled to it
    float y  = mix(0.5 + span * 0.58, 0.5 - span * 0.58, travel);

    float r = 0.34 + 0.20 * n;
    vec2  d = vec2((uv.x - xc) * cols, (uv.y - y) * cols);

    vec4 o = vec4(0.0);
    float dd = length(d * vec2(1.0, 0.84)) / r;
    if (dd < 1.12){
      float soft = 1.0 - smoothstep(0.94, 1.12, dd);
      float h = sqrt(max(0.0, 1.0 - min(dd, 1.0) * min(dd, 1.0)));
      o.xy = (-d / r) * soft;
      o.z  = max(h * soft, 0.028 * soft);
    }

    // the wet track it leaves above itself, thinning and fading with distance
    float tx = abs(d.x) / (r * 0.42);
    float ty = d.y;                                  // > 0 = behind (above) the head
    if (tx < 1.0 && ty > 0.0){
      o.w = exp(-ty * 0.42) * (1.0 - tx) * 0.85;
    }
    return o;
  }

  vec4 rain(vec2 p, float span, float t){
    /* Rotate the pane so gravity points at -y in this space.
       R must satisfy R * g = (0,-1). The old matrix collapsed to -I for the
       default straight-down gravity, which flipped the pane and sent every
       runner UP the screen. mat2() is column-major — that is where it went
       wrong. */
    vec2 g = normalize(uGravity + vec2(0.0, 0.0001));
    mat2 rot    = mat2(-g.y, -g.x,  g.x, -g.y);     // columns
    mat2 rotInv = mat2(-g.y,  g.x, -g.x, -g.y);     // transpose = inverse
    vec2 uv = rot * p * 0.5 + 0.5;                  // into 0–1 pane space

    /* Two layers, not three. The third ran at scale 34, which put its beads
       at two to five pixels — the specks that made the pane look dirty rather
       than wet. */
    vec4 a = beadField(uv, 13.0, 0.0);
    vec4 b = beadField(uv, 21.0, 3.1);

    vec4 r1 = runner(uv, t, 11.0, 0.0, span);
    vec4 r2 = runner(uv, t, 17.0, 4.3, span);

    // a runner sweeps the beads it passes into itself
    float wake = max(r1.w, r2.w);
    float clear = 1.0 - wake * 0.85;

    vec4 o;
    o.z  = max(max(a.z, b.z * 0.78) * clear, max(r1.z, r2.z));
    o.xy = (a.xy + b.xy * 0.68) * clear + r1.xy + r2.xy;
    o.w  = wake;

    /* The misting between beads is gone with them: it was a per-pixel hash at
       scale 220, which is single-pixel dust by definition. */

    o.xy = rotInv * o.xy;      // normals back into pane space
    return o;
  }

  void main(){
    vec2 px = vUv * uRes;
    vec4 scn  = texture2D(tScene, vUv);
    vec3 near = scn.rgb;
    vec3 l1 = texture2D(tL1, vUv).rgb;
    vec3 l2 = texture2D(tL2, vUv).rgb;
    vec3 l3 = texture2D(tL3, vUv).rgb;
    vec3 l4 = texture2D(tL4, vUv).rgb;
    vec3 l5 = texture2D(tL5, vUv).rgb;

    /* ── circle of confusion ──
       Depth drives it, and a tilt-shift band adds to it: only a horizontal
       strip of the frame stays sharp, everything above and below softens
       regardless of distance. */
    float depthCoc = smoothstep(uFocus, uFocus + uDofRange, scn.a);
    float tilt     = abs(vUv.y - uTiltCenter);
    float tiltCoc  = smoothstep(uTiltBand, uTiltBand + uTiltSoft, tilt) * uTiltAmt;
    float coc = clamp(max(depthCoc, tiltCoc), 0.0, 1.0);

    /* Four graded steps rather than one jump to mush — the near background
       only reaches L1, so it stays readable while the far haze goes to L4. */
    /* Five steps, not four. The back of the canopy was already pinned at the
       deepest level the pyramid had: sweeping uDofRange from 0.20 to 9.00 and
       the tilt from 0.70 to 0.82 both measured as no change at all, because
       coc was saturated and 1/16 was as soft as anything could get. Another
       octave gives the far beds somewhere left to go. */
    vec3 sharp = near;
    sharp = mix(sharp, l1, smoothstep(0.00, 0.22, coc));
    sharp = mix(sharp, l2, smoothstep(0.18, 0.42, coc));
    sharp = mix(sharp, l3, smoothstep(0.38, 0.62, coc));
    sharp = mix(sharp, l4, smoothstep(0.58, 0.82, coc));
    sharp = mix(sharp, l5, smoothstep(0.78, 1.00, coc));
    vec3 frost = l4;

    float inside = 0.0, rim = 0.0;
    vec2  local = vec2(0.0);
    float span  = 1.0;

    for (int i = 0; i < ${MAX_PANELS}; i++){
      if (i >= uCount) break;
      vec4 pn = uPanels[i];
      if (pn.z <= 0.0) continue;
      vec2 rel = px - pn.xy;
      float d  = sdRoundRect(rel, pn.zw, uRadius[i]);
      float in_ = smoothstep(1.0, -1.0, d);
      /* Divided by the panel half-height, a bead's size tracked how tall its
         div happened to be — measured 2.4px on the contact panel against 21px
         on a tall work card. Dividing by a fixed number of pixels instead
         makes every pane carry the same water. span carries the pane's own
         height through, so a runner still falls the full drop whatever the
         div's shape. */
      if (in_ > inside) {
        local = rel / uDropScale;
        span  = 2.0 * pn.w / uDropScale;
      }
      inside = max(inside, in_);
      rim    = max(rim, smoothstep(2.0, 0.0, abs(d)));
    }

    vec3 col = sharp;

    if (inside > 0.001){
      /* Clean matte black. Heavily blurred, quite transparent — you should
         read the forest through it as shapes and colour, never as detail. */
      vec3 glass = frost * 0.44 + vec3(0.007, 0.015, 0.021);
      glass += vec3(0.012, 0.026, 0.034) * (1.0 - abs(local.y));

      if (uWet > 0.001){
        vec4 r = rain(local, span, uTime);
        float bead  = clamp(r.z, 0.0, 1.0) * uWet;
        float trail = clamp(r.w, 0.0, 1.0) * uWet;

        /* A bead is a lens, and the part that sells it is that it resolves the
           scene far more sharply than the frosted pane it sits on. This used
           to sample tL1 — a blurred level — so every drop was a soft smudge of
           an already-soft image. It reads the sharp render instead. */
        /* The gain deliberately does NOT touch this. The refraction offset is
           geometry — how far the lens bends what sits behind it — and scaling
           it widened the area the drops disturb by 35%, which measured as a
           37% stronger effect overall rather than the 10% that was asked for. */
        vec2 off = r.xy * 0.014 * bead;
        vec3 through = texture2D(tScene, clamp(vUv + off, 0.002, 0.998)).rgb;

        /* Water has a contact line: a drop stops, it does not fade out. The
           cap height is smooth by construction, so a crisp coverage mask is
           derived from it for compositing, and the narrow band just inside the
           boundary becomes the bright meniscus ring every real drop carries. */
        float cover = smoothstep(0.052, 0.19, bead);
        float outerShadow = smoothstep(0.004, 0.032, bead)
                          * (1.0 - smoothstep(0.045, 0.145, bead));
        float ring  = smoothstep(0.032, 0.105, bead)
                    * (1.0 - smoothstep(0.115, 0.31, bead));

        // a wet track is a little clearer than dry glass
        glass = mix(glass, mix(glass, l3 * 0.52, 0.55), trail);
        /* One gain over the whole lobe — refraction, lens, meniscus and pin
           together — so "stronger water" is a single number rather than four
           constants that can drift apart. */
        glass = mix(glass, through * (0.60 * uWetGain) + vec3(0.008, 0.016, 0.021), cover);

        // Soft dark contact line, translucent meniscus, then an upper glint.
        glass *= 1.0 - outerShadow * 0.58 * uWetGain;
        glass += ring * vec3(0.10, 0.17, 0.19) * uWetGain;
        float glint = pow(bead, 14.0) * smoothstep(0.1, 0.7, -r.y);
        glass += glint * vec3(0.34, 0.46, 0.50) * uWetGain;
      }

      // Hard ceiling. The DOM text sits on top of this and no CSS can fix
      // its contrast against a surface that WebGL painted underneath.
      glass = min(glass, vec3(0.34));

      // uPanelOpacity < 1 lets the blurred forest read through the matte
      col = mix(col, glass, inside * uPanelOpacity);
      col += rim * inside * vec3(0.07, 0.19, 0.22) * uRimStrength;
    }

    // vignette — the reference photo falls off hard into the corners
    vec2 vc = (vUv - 0.5) * vec2(1.0, 0.92);
    col *= 0.36 + 0.64 * smoothstep(0.92, 0.14, length(vc));
    col *= uExposure;

    // dither, or the wall's smooth gradient bands badly at these levels
    col += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 190.0;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

/* ══════════════════════════════════════════════════ */

export function createForest(canvas, opts = {}) {
  const reduced  = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse   = matchMedia('(pointer: coarse)').matches;
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !lowPower, alpha: false, powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x030c11, 1);
  renderer.autoClear = false;

  const dprCap = lowPower ? 1.2 : 1.5;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);

  const sceneBack  = new THREE.Scene();
  const sceneFront = new THREE.Scene();
  const sceneUi    = new THREE.Scene();
  sceneUi.add(camera);

  // murky, not clear — depth should dissolve into it rather than recede
  const FOG_COLOR = new THREE.Color(0x010405);
  const COL_L = new THREE.Color(0xFF1236);
  const COL_R = new THREE.Color(0xFF1FA7);
  const POLE_DEPTH = 7.4;

  const panelsNdc = Array.from({ length: MAX_PANELS }, () => new THREE.Vector4());
  const avoidNdc  = Array.from({ length: MAX_PANELS }, () => new THREE.Vector4());
  const poleLxz = new THREE.Vector2(-POLE_DEPTH, -POLE_DEPTH);
  const poleRxz = new THREE.Vector2(POLE_DEPTH, -POLE_DEPTH);

  /* uniforms every lit surface shares */
  const lit = {
    uPoleL: { value: poleLxz }, uPoleR: { value: poleRxz },
    uColL:  { value: COL_L },   uColR:  { value: COL_R },
    uFogColor: { value: FOG_COLOR }
  };
  const common = {
    uTime:       { value: 0 },
    uMouse:      { value: new THREE.Vector2() },
    uScrollVel:  { value: 0 },
    uRubber:     { value: reduced ? 0 : 1 },
    uProjScale:  { value: Math.tan(THREE.MathUtils.degToRad(27.5)) },
    uAspect:     { value: 1 },
    uPanelCount: { value: 0 },
    uPanelsNdc:  { value: panelsNdc },
    uAvoidCount: { value: 0 },
    uAvoidNdc:   { value: avoidNdc },
    uRes:        { value: new THREE.Vector2(1, 1) },
    uStripOnLeaf:{ value: 0.44 },    // the neon IS the magenta in the plates
    uGreenGlow:  { value: 0.55 },
    uWetLeaf:    { value: 0.85 },    // 0 = dry matte, 1 = soaked and reflective
    uVeinGlow:   { value: 0.55 },    // ribs draw the leaf, the face stays dark
    uLeafWrap:   { value: 0.85 },    // heavily wrapped diffuse — no terminator
    uAmbient:    { value: 0.92 },    // hemisphere fill carries the foliage
    uFrontSpot:  { value: 1.0 },
    uSpotPos:    { value: new THREE.Vector3(2.2, 1.5, 3.8) },
    uDepthDim:   { value: 0.60 },    // wall only — foliage is spot-lit instead
    uDepthContrast: { value: 1.45 }, // gentler — soft look wants low contrast
    uStemFade:   { value: 0.04 },    // petiole goes to near-black at the crown
    uTipLight:   { value: 0.30 },    // dull pool at the tip, the other end of it
    uLeafSpot:   { value: 0.40 },    // per-blade spot on the top, facing front
    uLeafDark:   { value: 1.02 },    // regraded brighter to match the plates
    uLeafCool:   { value: new THREE.Vector3(0.42, 0.72, 1.05) },  // out of the pool: deep teal
    uLeafWarm:   { value: new THREE.Vector3(0.70, 1.48, 0.78) },  // in the pool: saturated green
    uSplitGain:  { value: 26.0 },    // calibrated so the pools span the key
    uEdgeSoft:   { value: 0.85 },    // rim falls away rather than cutting
    uLeafGloss:  { value: 0.60 },    // the wet, waxy face
    uRimPink:    { value: 0.0 },     // see the shader note — off by default
    uWetTop:     { value: 0.55 }     // water standing on the upward faces
  };

  /* ── wall ── */
  // World units the camera falls across the whole page — the single knob for
  // parallax speed. Halved from 78, then nudged back up 20%.
  const TRAVEL = 47;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 300),
    new THREE.ShaderMaterial({
      vertexShader: WALL_VERT, fragmentShader: WALL_FRAG,
      uniforms: Object.assign({}, lit, {
        uFogDensity: { value: 0.0150 },
        uDepthDim: common.uDepthDim        // shared, so one setter moves both
      })
    })
  );
  wall.position.set(0, -TRAVEL * 0.5, -46);
  wall.frustumCulled = false;
  sceneBack.add(wall);

  /* ── foliage ── */
  const geoHi = buildLeafGeometries(1);
  const geoLo = buildLeafGeometries(0);
  // the hero frond fills a third of the screen; it gets its own top tier
  const geoHero = lowPower ? geoHi : buildLeafGeometries(2);
  const meshes = [];

  function leafMaterial(fogDensity, sway, panelDim = 1) {
    return new THREE.ShaderMaterial({
      vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG,
      uniforms: Object.assign({}, lit, common, {
        uFogDensity: { value: fogDensity },
        uSway:       { value: sway },
        uPanelDim:   { value: panelDim }
      }),
      side: THREE.DoubleSide
    });
  }

  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Z = new THREE.Vector3(0, 0, 1);

  /* Deterministic RNG. The layout has to round-trip through the scene editor,
     so nothing about a plant may depend on Math.random(). */
  function rng32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* The four depth slabs — fog, sway, detail and which scene they render into. */
  const SLABS = [
    { id: 'far',   zMin: -40,  zMax: -26, sMin: 6,   sMax: 12,
      fog: 0.116, sway: 0.22, tint: 0.25, detail: 0, front: false },
    { id: 'mid',   zMin: -25,  zMax: -15, sMin: 4,   sMax: 7.5,
      fog: 0.080, sway: 0.38, tint: 0.32, detail: 0, front: false },
    { id: 'near',  zMin: -14,  zMax: -8,  sMin: 2.8, sMax: 5,
      fog: 0.050, sway: 0.58, tint: 0.30, detail: 1, front: false },
    { id: 'front', zMin: -5.5, zMax: -3,  sMin: 2.2, sMax: 3.7,
      fog: 0.020, sway: 0.76, tint: 0.22, detail: 1, front: true, panelDim: 0.28 }
  ];

  /* ── congregation points ────────────────────────────
     Five beds the planting grows out of, rather than 68 plants scattered at
     random. Each one holds an x/z position in the frame and its plants run the
     full height of the page from it, so the framing stays consistent as you
     scroll and moving a bed moves that whole column of foliage.
     They alternate sides and step forward through the depth slabs. */
  const CLUSTERS = [
    { id: 'back left',  x: -40, z: -32, slab: 0, count: 14, spreadX: 12, spreadZ: 6 },
    { id: 'back right', x:  42, z: -31, slab: 0, count: 14, spreadX: 12, spreadZ: 6 },
    { id: 'mid left',   x: -25, z: -20, slab: 1, count: 12, spreadX: 9,  spreadZ: 5 },
    { id: 'near right', x:  18, z: -11, slab: 2, count: 9, spreadX: 7,  spreadZ: 3 },
    { id: 'front left', x: -10, z:  -4, slab: 3, count: 7, spreadX: 6,  spreadZ: 1.2 }
  ];

  /** Leaves per plant. Six plants, five leaves each — a composed group rather
      than a scattering, so every leaf is placeable by hand. */
  const LEAVES_PER_PLANT = 5;

  /**
   * One plant as the editor sees it: which bed it belongs to, its offset from
   * that bed, and the handful of numbers its rosette derives from. Everything
   * inside the plant comes back out of `seed`, so the editor only ever has to
   * move beds and offsets around.
   */
  function generatePlants(clusters) {
    const out = [];
    clusters.forEach((cl, ci) => {
      const cfg = SLABS[cl.slab];
      const r = rng32(0xC0FFEE + ci * 7919);
      for (let p = 0; p < cl.count; p++) {
        out.push({
          cluster: ci,
          ox: +((r() * 2 - 1) * cl.spreadX).toFixed(2),
          oy: +(8 - r() * (TRAVEL + 26)).toFixed(2),   // spread down the page
          oz: +((r() * 2 - 1) * cl.spreadZ).toFixed(2),
          scale: +(cfg.sMin + r() * (cfg.sMax - cfg.sMin)).toFixed(2),
          species: Math.floor(r() * LEAF_TYPES),
          lean: +(-Math.sign(cl.x || 1) * (0.25 + r() * 0.55)).toFixed(3),
          n: 3 + Math.floor(r() * 3),
          az0: +(r() * Math.PI * 2).toFixed(3),
          seed: (r() * 4294967296) >>> 0
        });
      }
    });
    return out;
  }

  /* Accepts the current {clusters, plants} shape, or a legacy flat array of
     plants with absolute positions. */
  function normaliseLayout(raw) {
    if (Array.isArray(raw)) {
      return {
        clusters: CLUSTERS.map(c => ({ ...c })),
        plants: raw.map(p => ({ ...p, cluster: -1, ox: p.x, oy: p.y, oz: p.z }))
      };
    }
    return {
      clusters: (raw.clusters || CLUSTERS).map(c => ({ ...c })),
      plants: (raw.plants || []).map(p => ({ ...p }))
    };
  }

  const slabMeshes = [];

  /* Build the instanced meshes for one slab from the shared plant list. */
  function buildSlab(cfg, slabIndex, lay) {
    const mat = leafMaterial(cfg.fog, cfg.sway, cfg.panelDim);
    const geos = cfg.detail ? geoHi : geoLo;
    const scene = cfg.front ? sceneFront : sceneBack;
    const buckets = Array.from({ length: LEAF_TYPES }, () => []);

    const scl = new THREE.Vector3();
    const qPlant = new THREE.Quaternion(), qAz = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion(), qRoll = new THREE.Quaternion();
    const qq = new THREE.Quaternion();

    /* Resolve a restrained canopy-to-canopy pressure once when the slab is
       built. The resulting vector flexes the upper stem in the shader; it
       never translates the planted foot and costs nothing per-frame. */
    const frames = lay.plants.flatMap(pl => {
      const cl = pl.cluster >= 0 ? lay.clusters[pl.cluster] : null;
      const slabOf = cl ? cl.slab : pl.slab;
      if (slabOf !== slabIndex) return [];

      const crown = new THREE.Vector3(
        (cl ? cl.x : 0) + pl.ox,
        pl.oy,
        (cl ? cl.z : 0) + pl.oz
      );
      const edge = THREE.MathUtils.smoothstep(Math.abs(crown.x), 5, 28);
      const edgeScale = THREE.MathUtils.lerp(0.76, 1.0, edge);
      return [{ pl, cl, crown, edge, edgeScale, push: new THREE.Vector2() }];
    });

    for (let i = 0; i < frames.length; i++) {
      const a = frames[i];
      for (let j = 0; j < frames.length; j++) {
        if (i === j) continue;
        const b = frames[j];
        const dx = a.crown.x - b.crown.x;
        const dy = a.crown.y - b.crown.y;
        const dz = Math.abs(a.crown.z - b.crown.z);
        const dist = Math.hypot(dx, dy);
        const reach = Math.max(1.5, (a.pl.scale * a.edgeScale + b.pl.scale * b.edgeScale) * 0.27);
        if (dist >= reach || dz > reach * 0.9) continue;
        const fallback = ((a.pl.seed ^ b.pl.seed) & 1) ? 1 : -1;
        const ux = dist > 0.001 ? dx / dist : fallback;
        const uy = dist > 0.001 ? dy / dist : 0.25;
        const pressure = (1 - dist / reach) * Math.min(0.42, reach * 0.075);
        a.push.x += ux * pressure;
        a.push.y += uy * pressure;
      }
      const pushLen = a.push.length();
      if (pushLen > 0.48) a.push.multiplyScalar(0.48 / pushLen);
    }

    for (const frame of frames) {
      const { pl, crown, edge, edgeScale, push } = frame;

      const r = rng32(pl.seed);
      /* Side beds lean farther inward than the old radial planting. Together
         with the curved blades this creates a loose arch around the clearing. */
      qPlant.setFromAxisAngle(AXIS_Z, pl.lean * (1.10 + edge * 0.28));
      const toneRoll = (pl.seed % 1000) / 1000;
      const toneLevel = 0.62 + (((pl.seed >>> 10) % 1000) / 1000) * 0.38;
      const plantTint = toneRoll < cfg.tint ? toneLevel : 0;
      const leafCount = Math.min(pl.n, 3 + ((pl.seed >>> 5) % 3));

      for (let i = 0; i < leafCount; i++) {
        qAz.setFromAxisAngle(AXIS_Y, pl.az0 + (i / leafCount) * Math.PI * 2 + (r() - 0.5) * 0.22);
        qTilt.setFromAxisAngle(AXIS_X, 0.18 + r() * 1.28);
        qRoll.setFromAxisAngle(AXIS_Y, (r() - 0.5) * 0.54);
        qq.copy(qPlant).multiply(qAz).multiply(qTilt).multiply(qRoll);

        // Strong size hierarchy at the edge, restrained growth in the clearing.
        const s = pl.scale * edgeScale * (0.48 + r() * 0.58);
        scl.set(s, s, s);

        buckets[pl.species].push({
          m: new THREE.Matrix4().compose(crown, qq, scl),
          phase: r() * Math.PI * 2,
          tint: plantTint,
          stiff: 0.55 + r() * 0.9,
          push: push.clone()
        });
      }
    }

    for (let g = 0; g < LEAF_TYPES; g++) {
      const list = buckets[g];
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geos[g].clone(), mat, list.length);
      mesh.frustumCulled = false;
      const phase = new Float32Array(list.length);
      const tintA = new Float32Array(list.length);
      const stiff = new Float32Array(list.length);
      const neighborPush = new Float32Array(list.length * 2);
      list.forEach((inst, i) => {
        mesh.setMatrixAt(i, inst.m);
        phase[i] = inst.phase; tintA[i] = inst.tint; stiff[i] = inst.stiff;
        neighborPush[i * 2] = inst.push.x;
        neighborPush[i * 2 + 1] = inst.push.y;
      });
      mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
      mesh.geometry.setAttribute('aTint',  new THREE.InstancedBufferAttribute(tintA, 1));
      mesh.geometry.setAttribute('aStiff', new THREE.InstancedBufferAttribute(stiff, 1));
      mesh.geometry.setAttribute('aNeighborPush', new THREE.InstancedBufferAttribute(neighborPush, 2));
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      meshes.push(mesh);
      slabMeshes.push(mesh);
    }
  }

  const q = lowPower ? 0.45 : 1;

  let layout = opts.layout
    ? normaliseLayout(opts.layout)
    : { clusters: CLUSTERS.map(c => ({ ...c })), plants: generatePlants(CLUSTERS) };

  /* A saved layout would otherwise bypass the low-power plant reduction and
     hand a phone the full desktop forest, so it is thinned the same way —
     evenly spread, never in contiguous blocks. */
  if (q < 1) {
    layout.plants = layout.plants.filter(
      (_, i) => Math.floor(i * q) !== Math.floor((i - 1) * q));
  }

  function buildAllSlabs() {
    for (const m of slabMeshes) {
      if (m.parent) m.parent.remove(m);
      m.geometry.dispose();
      const k = meshes.indexOf(m);
      if (k >= 0) meshes.splice(k, 1);
    }
    slabMeshes.length = 0;
    SLABS.forEach((cfg, i) => buildSlab(cfg, i, layout));
  }
  buildAllSlabs();
  /* ── hero frond ──
     One deliberate leaf reaching into the top of the first screen from the
     upper right, hanging down-left across the corner. The camera falls as you
     scroll, so it lifts out of frame on its own. Everything else in the scene
     is randomised; this one is placed. */
  function heroFrond() {
    const mat = leafMaterial(0.004, 1.25, 0.34);
    const mesh = new THREE.InstancedMesh(geoHero[0].clone(), mat, 1); // monstera
    mesh.frustumCulled = false;

    /* Kept nearly face-on. Tilting it away from the camera foreshortens the
       blade into a narrow sliver no matter how round its outline is, which is
       what made earlier versions read as pointed. */
    const q = new THREE.Quaternion()
      .setFromAxisAngle(AXIS_Z, 2.55)                                  // swing down-left
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, 0.16)) // barely tipped
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, 0.08));

    mesh.setMatrixAt(0, new THREE.Matrix4().compose(
      new THREE.Vector3(4.62, 4.62, -5.0),     // cropped by the upper-right edge
      q,
      new THREE.Vector3(2.46, 2.46, 2.46)
    ));
    mesh.instanceMatrix.needsUpdate = true;

    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array([1.7]), 1));
    mesh.geometry.setAttribute('aTint',  new THREE.InstancedBufferAttribute(new Float32Array([0.0]), 1));
    mesh.geometry.setAttribute('aStiff', new THREE.InstancedBufferAttribute(new Float32Array([1.25]), 1));
    mesh.geometry.setAttribute('aNeighborPush', new THREE.InstancedBufferAttribute(new Float32Array([0, 0]), 2));

    sceneFront.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  const hero = heroFrond();

  /* Six composed edge specimens complete the opening frame. Random planting
     supplies depth down the page, but the first view needs the deliberate
     top/side/bottom rhythm of the reference plates: one wine-coloured spear
     rising from below and one fine teal frond hanging from the upper-left. */
  function edgeFrond(species, {
    x, y, z, scale, swing, lean, spin, tint, phase
  }) {
    const mat = leafMaterial(0.007, 1.05, 0.34);
    const mesh = new THREE.InstancedMesh(geoHero[species].clone(), mat, 1);
    mesh.frustumCulled = false;
    const qq = new THREE.Quaternion()
      .setFromAxisAngle(AXIS_Z, swing)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, lean))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, spin));
    mesh.setMatrixAt(0, new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), qq, new THREE.Vector3(scale, scale, scale)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array([phase]), 1));
    mesh.geometry.setAttribute('aTint',  new THREE.InstancedBufferAttribute(new Float32Array([tint]), 1));
    mesh.geometry.setAttribute('aStiff', new THREE.InstancedBufferAttribute(new Float32Array([1.15]), 1));
    mesh.geometry.setAttribute('aNeighborPush', new THREE.InstancedBufferAttribute(new Float32Array([0, 0]), 2));
    sceneFront.add(mesh);
    meshes.push(mesh);
    return mesh;
  }

  const edgeFronds = [
    edgeFrond(1, {
      x: -4.55, y: -3.75, z: -5.2, scale: 1.88,
      swing: -0.54, lean: 0.36, spin: -0.12, tint: 1.0, phase: 3.4
    }),
    edgeFrond(3, {
      x: -4.10, y: 3.72, z: -6.0, scale: 1.82,
      swing: 2.70, lean: 0.46, spin: 0.20, tint: 0.0, phase: 5.1
    }),
    edgeFrond(0, {
      x: 4.62, y: -3.48, z: -5.5, scale: 1.82,
      swing: 0.68, lean: 0.30, spin: -0.16, tint: 0.0, phase: 0.8
    }),
    edgeFrond(1, {
      x: 4.58, y: -0.35, z: -6.3, scale: 1.42,
      swing: 1.78, lean: 0.40, spin: -0.18, tint: 0.88, phase: 2.2
    }),
    edgeFrond(3, {
      x: -1.10, y: 4.78, z: -7.0, scale: 1.42,
      swing: 3.02, lean: 0.44, spin: 0.08, tint: 0.0, phase: 4.2
    }),
    edgeFrond(2, {
      x: 1.75, y: 4.72, z: -7.5, scale: 1.32,
      swing: 3.40, lean: 0.38, spin: -0.10, tint: 0.74, phase: 5.8
    })
  ];

  /** Reposition the hero frond without touching the rest of the scene. */
  function placeHero({ x = 4.62, y = 4.62, z = -5.0, scale = 2.46,
                       swing = 2.55, lean = 0.16, spin = 0.08 } = {}) {
    const q = new THREE.Quaternion()
      .setFromAxisAngle(AXIS_Z, swing)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, lean))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, spin));
    hero.setMatrixAt(0, new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale)));
    hero.instanceMatrix.needsUpdate = true;
  }

  /* ── mist ── */
  const mistMat = new THREE.ShaderMaterial({
    vertexShader: MIST_VERT,
    fragmentShader: MIST_FRAG,
    uniforms: Object.assign({}, lit, {
      uTime: common.uTime,
      uMist: { value: 0.26 }
    }),
    transparent: true, depthWrite: false, depthTest: true,
    /* Colour blends normally, but the alpha channel is left exactly as it
       was: that channel carries linear depth for the DOF pass, and a cloud
       stamping its own depth would pull whatever sits behind it into focus.
       Untouched, each wisp inherits the blur of the thing it drifts over —
       which is what makes it read as air rather than as a decal. */
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
  });

  function buildMist() {
    const COUNT = lowPower ? 24 : 56;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(base.getIndex());
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    geo.instanceCount = COUNT;

    const pos = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    const r = rng32(0x51CEC0);

    for (let i = 0; i < COUNT; i++) {
      // biased outward: the corridor down the middle stays clear for the panes
      const side = r() < 0.5 ? -1 : 1;
      pos[i * 3]     = side * (11 + r() * 48);
      /* Spread has to overrun the travel at BOTH ends. Starting the band at
         the camera's own y left the top of the first screen in clear air and
         piled every puff up at the bottom of the page — coverage ramped from
         15% to 55% over the scroll instead of holding steady. */
      pos[i * 3 + 1] = 26 - r() * (TRAVEL + 52);
      // between the far planting and the wall, never in front of the panes
      pos[i * 3 + 2] = -16 - r() * 27;
      size[i] = 14 + r() * 22;
      seed[i] = r();
    }

    geo.setAttribute('aPos',  new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));

    const m = new THREE.Mesh(geo, mistMat);
    m.frustumCulled = false;     // billboards are expanded in the shader
    m.renderOrder = 2;           // after the wall and the back slabs
    sceneBack.add(m);
    return m;
  }
  const mist = buildMist();

  /* ── neon strips ── */
  const poleGeo = new THREE.PlaneGeometry(1.62, 48);  // slightly wider neon tube
  function makePole(color) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: POLE_FRAG,
      uniforms: {
        uColor: { value: color }, uTime: common.uTime,
        uDepth: { value: POLE_DEPTH / DEPTH_SCALE }
      },
      transparent: true, depthWrite: false, depthTest: true,
      // Additive colour. Alpha uses MIN so the strip stamps its own near depth
      // where it is bright and leaves the scene's depth alone where it is not.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.MinEquation,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
    });
    const m = new THREE.Mesh(poleGeo, mat);
    m.position.z = -POLE_DEPTH;
    camera.add(m);
    return m;
  }
  const poleL = makePole(COL_L);
  const poleR = makePole(COL_R);

  /* ── targets & passes ── */
  const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, stencilBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: true });
  if (!lowPower && renderer.capabilities.isWebGL2) {
    rtScene.samples = Math.min(4, renderer.capabilities.maxSamples || 4);
  }

  /* A blur pyramid: each level blurs the level above it at half the
     resolution again, so the softness climbs in even steps instead of
     jumping straight from sharp to mush.
     shift 1 → ½ res, 2 → ¼, 3 → ⅛, 4 → 1⁄16, 5 → 1⁄32 */
  const LEVELS = [1, 2, 3, 4, 5];
  const blurLevels = LEVELS.map(shift => ({
    shift,
    tmp: new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false }),
    out: new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false })
  }));

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  const blurMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG,
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    depthTest: false, depthWrite: false
  });

  const panelData  = Array.from({ length: MAX_PANELS }, () => new THREE.Vector4());
  const radiusData = new Float32Array(MAX_PANELS);

  const glassMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: GLASS_FRAG,
    uniforms: {
      tScene: { value: null },
      tL1: { value: null }, tL2: { value: null },
      tL3: { value: null }, tL4: { value: null }, tL5: { value: null },
      uRes: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uGravity: { value: new THREE.Vector2(0, -1) },
      uCount: { value: 0 },
      uPanels: { value: panelData },
      uRadius: { value: radiusData },
      uWet: { value: 1.0 },            // mostly-still beads; toggle turns them off
      uDropScale: { value: 195.0 },    // keeps the old bead size on a ~390px pane
      /* 1.05, not 1.10, for a 10% stronger effect. The gain scales the lens
         colour, but what you see is that colour's distance from the dry pane
         underneath it — so the visible change runs a bit over twice the gain.
         Measured across five scroll positions: 1.04 -> +7.9%, 1.05 -> +10.1%,
         1.10 -> +23%. Raise this to make the water read harder. */
      uWetGain:   { value: 1.05 },
      uPanelOpacity: { value: 0.75 },  // 25% more transparent than solid
      uRimStrength: { value: 0.0 },    // no lit edge; the frosting is the edge
      uFocus: { value: 0.050 },        // hold focus on the nearest fronds only
      // Wide enough that mid-distance foliage lands on L1/L2 and keeps some
      // definition — and so the tilt-shift has room to act instead of being
      // swallowed by a depth blur that has already saturated.
      /* Left at 0.62. Shortening it to 0.42 measured as nothing: coc is
         max(depthCoc, tiltCoc), and with the tilt at 0.82 the tilt term wins
         everywhere outside the central sharp band, so the depth term only has
         headroom in the middle of the frame. Sweeping this from 0.20 to 9.00
         moved whole-frame sharpness 1.62 to 1.66 — noise. The tilt is the
         knob that actually softens the back. */
      uDofRange: { value: 0.62 },
      uTiltAmt: { value: 0.82 },       // tilt-shift on top of the depth blur
      uTiltCenter: { value: 0.5 },
      uTiltBand: { value: 0.14 },
      uTiltSoft: { value: 0.40 },
      uExposure: { value: 0.88 }       // overall darkness
    },
    depthTest: false, depthWrite: false
  });

  const blurScene = new THREE.Scene();  blurScene.add(new THREE.Mesh(quadGeo, blurMat));
  const glassScene = new THREE.Scene(); glassScene.add(new THREE.Mesh(quadGeo, glassMat));

  /* ── state ── */
  const state = {
    scroll: 0, scrollTarget: 0, vel: 0,
    mouse: new THREE.Vector2(), mouseTarget: new THREE.Vector2(),
    gravity: new THREE.Vector2(0, -1),
    panels: [], avoidance: [], running: true
  };

  let W = 0, H = 0, dpr = 1;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(devicePixelRatio || 1, dprCap);
    if (w === W && h === H) return;
    W = w; H = h;

    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    common.uAspect.value = camera.aspect;

    /* The desktop arch deliberately lives outside the narrow phone frustum.
       Pull just the hero monstera inward on phones so there is still one wet,
       cropped botanical cue without closing over the mobile headline. */
    if (w < 760) {
      placeHero({ x: 3.80, y: 4.68, z: -5.0, scale: 2.25,
                  swing: 2.55, lean: 0.16, spin: 0.08 });
    } else {
      placeHero();
    }

    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    rtScene.setSize(pw, ph);
    for (const lv of blurLevels) {
      const lw = Math.max(2, pw >> lv.shift), lh = Math.max(2, ph >> lv.shift);
      lv.tmp.setSize(lw, lh);
      lv.out.setSize(lw, lh);
    }
    glassMat.uniforms.uRes.value.set(pw, ph);
    common.uRes.value.set(pw, ph);

    // Anchor the strips to a fraction of the frustum, never a fixed world x —
    // a constant offset sails off-screen the moment the aspect narrows.
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * POLE_DEPTH;
    const halfW = halfH * camera.aspect;
    const spread = halfW * (w < 760 ? 0.96 : 0.82);
    poleL.position.x = -spread;
    poleR.position.x = spread;
    const sc = halfH / 4.7;
    poleL.scale.set(sc, sc, 1);
    poleR.scale.set(sc, sc, 1);

    poleLxz.set(-spread, -POLE_DEPTH);
    poleRxz.set(spread, -POLE_DEPTH);
  }

  function syncPanels() {
    const list = state.panels;
    const n = Math.min(list.length, MAX_PANELS);
    for (let i = 0; i < n; i++) {
      const r = list[i];
      const cx = (r.left + r.width / 2), cy = (r.top + r.height / 2);
      panelData[i].set(cx * dpr, (H - cy) * dpr, (r.width / 2) * dpr, (r.height / 2) * dpr);
      radiusData[i] = (r.radius || 18) * dpr;
      // NDC copy for the foliage — same rectangles, different space
      panelsNdc[i].set(
        (cx / W) * 2 - 1, -((cy / H) * 2 - 1),
        (r.width / W), (r.height / H)
      );
    }
    for (let i = n; i < MAX_PANELS; i++) { panelData[i].set(0, 0, 0, 0); panelsNdc[i].set(0, 0, 0, 0); }
    glassMat.uniforms.uCount.value = n;
    common.uPanelCount.value = n;

    const avoid = state.avoidance;
    const an = Math.min(avoid.length, MAX_PANELS);
    for (let i = 0; i < an; i++) {
      const r = avoid[i];
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      avoidNdc[i].set(
        (cx / W) * 2 - 1, -((cy / H) * 2 - 1),
        r.width / W, r.height / H
      );
    }
    for (let i = an; i < MAX_PANELS; i++) avoidNdc[i].set(0, 0, 0, 0);
    common.uAvoidCount.value = an;
  }

  let raf = 0, t0 = performance.now(), prevScroll = 0;

  function render(now) {
    raf = requestAnimationFrame(render);
    if (!state.running) return;
    drawFrame(now);
  }

  function drawFrame(now) {
    resize();
    if (!W || !H) return;

    const t = (now - t0) / 1000;

    state.scroll += (state.scrollTarget - state.scroll) * 0.085;
    state.vel = state.vel * 0.85 + (state.scroll - prevScroll) * 0.15;
    prevScroll = state.scroll;
    state.mouse.lerp(state.mouseTarget, 0.055);

    camera.position.y = -state.scroll * TRAVEL;
    camera.updateMatrixWorld();

    common.uTime.value = reduced ? 4 : t;
    common.uMouse.value.copy(state.mouse);
    // Half-strength inertial leaf movement: page travel is unchanged, only the
    // foliage's extra scroll-driven sway is reduced.
    common.uScrollVel.value = reduced ? 0 : THREE.MathUtils.clamp(state.vel * 15, -0.8, 0.8);
    common.uSpotPos.value.set(2.2, camera.position.y + 1.45, 3.8);
    syncPanels();

    // 1 — back scene
    renderer.setRenderTarget(rtScene);
    renderer.clear(true, true, false);
    renderer.render(sceneBack, camera);
    renderer.render(sceneUi, camera);

    // 2 — blur pyramid, each level fed by the one above it
    let src = rtScene.texture;
    for (const lv of blurLevels) {
      blurMat.uniforms.tSrc.value = src;
      blurMat.uniforms.uDir.value.set(1 / lv.tmp.width, 0);
      renderer.setRenderTarget(lv.tmp);
      renderer.clear(true, false, false);
      renderer.render(blurScene, quadCam);

      blurMat.uniforms.tSrc.value = lv.tmp.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / lv.out.height);
      renderer.setRenderTarget(lv.out);
      renderer.clear(true, false, false);
      renderer.render(blurScene, quadCam);

      src = lv.out.texture;
    }

    // 3 — depth of field + glass to screen
    glassMat.uniforms.tScene.value = rtScene.texture;
    glassMat.uniforms.tL1.value = blurLevels[0].out.texture;
    glassMat.uniforms.tL2.value = blurLevels[1].out.texture;
    glassMat.uniforms.tL3.value = blurLevels[2].out.texture;
    glassMat.uniforms.tL4.value = blurLevels[3].out.texture;
    glassMat.uniforms.tL5.value = blurLevels[4].out.texture;
    glassMat.uniforms.uTime.value  = reduced ? 4 : t;
    glassMat.uniforms.uGravity.value.copy(state.gravity);
    renderer.setRenderTarget(null);
    renderer.clear(true, true, false);
    renderer.render(glassScene, quadCam);

    // 4 — foreground fronds cross in front of the glass
    renderer.clearDepth();
    renderer.render(sceneFront, camera);
  }

  const api = {
    state, renderer,
    renderOnce(now) { drawFrame(now == null ? performance.now() : now); },
    setScroll(v) { state.scrollTarget = THREE.MathUtils.clamp(v, 0, 1); },
    setMouse(x, y) { state.mouseTarget.set(x, y); },
    setPanels(list) { state.panels = list; },
    setAvoidance(list) { state.avoidance = list; },
    setGravity(x, y) { state.gravity.set(x, y); },
    setWet(v) { glassMat.uniforms.uWet.value = v; },
    /** pixels per droplet unit — smaller makes every bead on every pane smaller */
    setDropScale(v) { glassMat.uniforms.uDropScale.value = v; },
    /** overall strength of the water: refraction, lens, meniscus and glint together */
    setWetGain(v) { glassMat.uniforms.uWetGain.value = v; },
    setRubber(v) { common.uRubber.value = v; },
    /** focus: normalised depth held sharp (0–1). range: how fast it falls off.
     *  Smaller range = shorter focal length = softer background. */
    setFocus(focus, range) {
      if (focus != null) glassMat.uniforms.uFocus.value = focus;
      if (range != null) glassMat.uniforms.uDofRange.value = range;
    },
    /** amount 0–1, band = half-height of the sharp strip, soft = falloff */
    setTilt(amount, band, soft, center) {
      const u = glassMat.uniforms;
      if (amount != null) u.uTiltAmt.value = amount;
      if (band   != null) u.uTiltBand.value = band;
      if (soft   != null) u.uTiltSoft.value = soft;
      if (center != null) u.uTiltCenter.value = center;
    },
    setExposure(v) { glassMat.uniforms.uExposure.value = v; },
    /** how hard the neon strips light the foliage (wall is unaffected) */
    setStripOnLeaf(v) { common.uStripOnLeaf.value = v; },
    /** 1 = solid matte pane, lower lets more of the forest through */
    setPanelOpacity(v) { glassMat.uniforms.uPanelOpacity.value = v; },
    setRimStrength(v) { glassMat.uniforms.uRimStrength.value = v; },
    /** green transmission on leaves near a strip and near the camera */
    setGreenGlow(v) { common.uGreenGlow.value = v; },
    /** 0 = dry matte foliage, 1 = soaked and reflective */
    setWetLeaf(v) { common.uWetLeaf.value = v; },
    /** camera-following photographic key on the foreground wet leaves */
    setFrontSpot(v) { common.uFrontSpot.value = v; },
    /** how strongly the midrib and veins pick up the nearest strip colour */
    setVeinGlow(v) { common.uVeinGlow.value = v; },
    /** value retained by the furthest foliage; 1 = no depth falloff */
    setDepthDim(v) { common.uDepthDim.value = v; },
    /** gamma applied at full depth; > 1 pulls distant shadows down harder */
    setDepthContrast(v) { common.uDepthContrast.value = v; },
    /** how dark the petiole goes where it meets the crown; 1 = no fade */
    setStemFade(v) { common.uStemFade.value = v; },
    /** dull pool of light landing on the blade tips; 0 = off */
    setTipLight(v) { common.uTipLight.value = v; },
    /** per-blade spot on the upper, camera-facing face; 0 = off */
    setLeafSpot(v) { common.uLeafSpot.value = v; },
    /** blade albedo multiplier; 1 = the old value, lower is darker */
    setLeafDark(v) { common.uLeafDark.value = v; },
    /** split-tone the blade: shadow tint, lit tint, and the luminance between them */
    setLeafTone(cool, warm, gain) {
      if (cool) common.uLeafCool.value.set(cool[0], cool[1], cool[2]);
      if (warm) common.uLeafWarm.value.set(warm[0], warm[1], warm[2]);
      if (gain != null) common.uSplitGain.value = gain;
    },
    /** how far the silhouette falls away at the rim; 0 = hard cut */
    setEdgeSoft(v) { common.uEdgeSoft.value = v; },
    /** broad waxy sheen across the blade — the thing that reads as wet */
    setLeafGloss(v) { common.uLeafGloss.value = v; },
    /** magenta rim light where the blade turns away */
    setRimPink(v) { common.uRimPink.value = v; },
    /** water standing on the upward-facing surfaces; 0 = dry on top */
    setWetTop(v) { common.uWetTop.value = v; },
    /** density of the dark cloud drifting between the beds; 0 = clear air */
    setMist(v) { mistMat.uniforms.uMist.value = v; },
    mistInfo() { return { puffs: mist.geometry.instanceCount, density: mistMat.uniforms.uMist.value }; },

    /* ── scene layout ──
       `getLayout()` returns a serialisable copy of {clusters, plants};
       `setLayout()` rebuilds every slab from it. Used by editor.html. */
    getLayout() {
      return {
        clusters: layout.clusters.map(c => ({ ...c })),
        plants: layout.plants.map(p => ({ ...p }))
      };
    },
    setLayout(next) {
      layout = {
        clusters: (next.clusters || layout.clusters).map(c => ({ ...c })),
        plants: (next.plants || []).map(p => ({ ...p }))
      };
      buildAllSlabs();
    },
    slabInfo() { return SLABS.map((s, i) => ({ index: i, ...s })); },
    /** world units the camera falls across the whole page */
    travel: TRAVEL,
    /** 0 = hard Lambert terminator, 1 = fully wrapped soft foliage light */
    setLeafWrap(v) { common.uLeafWrap.value = v; },
    /** strength of the hemisphere fill that carries the canopy */
    setAmbient(v) { common.uAmbient.value = v; },
    hero, edgeFronds, placeHero,
    dispose() {
      cancelAnimationFrame(raf);
      meshes.forEach(m => m.geometry.dispose());
      [...geoHi, ...geoLo, ...geoHero].forEach(g => g.dispose());
      rtScene.dispose();
      blurLevels.forEach(lv => { lv.tmp.dispose(); lv.out.dispose(); });
      renderer.dispose();
    }
  };

  resize();
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { state.running = !document.hidden; });

  raf = requestAnimationFrame(render);
  return api;
}
