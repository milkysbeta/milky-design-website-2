struct AtmosphereParams {
  time: f32,
  scroll: f32,
  resolution: vec2f,
  intensity: f32,
  quality: f32,
}

@group(0) @binding(0) var<uniform> params: AtmosphereParams;

fn hash21(p: vec2f) -> f32 {
  let q = fract(p * vec2f(123.34, 456.21));
  return fract((q.x + dot(q, q + 45.32)) * (q.y + 19.19));
}

fn valueNoise(p: vec2f) -> f32 {
  let cell = floor(p);
  let local = fract(p);
  let eased = local * local * (3.0 - 2.0 * local);
  let a = hash21(cell);
  let b = hash21(cell + vec2f(1.0, 0.0));
  let c = hash21(cell + vec2f(0.0, 1.0));
  let d = hash21(cell + vec2f(1.0, 1.0));
  return mix(mix(a, b, eased.x), mix(c, d, eased.x), eased.y);
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var sum = 0.0;
  var weight = 0.5;
  for (var i = 0; i < 4; i = i + 1) {
    sum += valueNoise(p) * weight;
    p = p * 2.03 + vec2f(7.1, 3.7);
    weight *= 0.5;
  }
  return sum;
}

fn softLine(x: f32, center: f32, width: f32) -> f32 {
  return exp(-abs(x - center) / max(width, 0.0001));
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.resolution.x / max(params.resolution.y, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);
  let drift = vec2f(params.time * 0.006, -params.time * 0.004 + params.scroll * 1.7);
  let broadFog = fbm(p * 2.15 + drift);
  var fineFog = 0.48;
  if (params.quality > 0.5) {
    fineFog = fbm(p * 5.4 - drift * 1.8 + 13.7);
  }
  let bank = smoothstep(0.34, 0.82, broadFog * 0.76 + fineFog * 0.34);
  let depthMask = smoothstep(0.02, 0.92, uv.y) * (0.62 + 0.38 * sin((uv.y + params.scroll) * 3.14159));

  let leftPole = softLine(uv.x, 0.035, 0.032);
  let rightPole = softLine(uv.x, 0.965, 0.038);
  let polePulse = 0.88 + 0.12 * sin(params.time * 0.33 + params.scroll * 5.0);
  let neon = (leftPole * 0.86 + rightPole) * polePulse;

  // Fine near-camera rain: sparse, vertical and deliberately slow so it reads
  // as weather in the light rather than a decorative particle layer.
  let rainGrid = vec2f(floor(uv.x * 92.0), floor((uv.y + params.time * 0.055) * 46.0));
  let rainSeed = hash21(rainGrid);
  let rainCell = fract(vec2f(uv.x * 92.0, (uv.y + params.time * 0.055) * 46.0));
  let rain = step(0.982, rainSeed) * smoothstep(0.10, 0.48, rainCell.y) * smoothstep(0.94, 0.62, rainCell.y) * exp(-abs(rainCell.x - rainSeed) * 34.0);

  let fogAlpha = bank * depthMask * mix(0.055, 0.105, params.quality);
  let lightAlpha = neon * 0.135 + rain * 0.13;
  let alpha = clamp((fogAlpha + lightAlpha) * params.intensity, 0.0, 0.30);

  let cyan = vec3f(0.08, 0.72, 0.72);
  let neonRed = vec3f(1.0, 0.025, 0.085);
  let neonPink = vec3f(1.0, 0.035, 0.56);
  let wetWhite = vec3f(0.58, 0.88, 0.86);
  let fogColour = vec3f(0.002, 0.009, 0.012);
  let litFog = mix(fogColour, cyan * 0.10, bank * 0.25);
  let neonColour = mix(neonRed, neonPink, clamp(rightPole / max(leftPole + rightPole, 0.0001), 0.0, 1.0));
  let colour = litFog * fogAlpha + neonColour * neon * 0.115 + wetWhite * rain * 0.09;

  // Surface alpha mode is premultiplied; keep transparent pixels colourless.
  return vec4f(colour * params.intensity, alpha);
}
