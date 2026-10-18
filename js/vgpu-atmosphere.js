let mt = class extends Error {
  code;
  severity;
  fix;
  where;
  cause;
  detail;
  constructor(t) {
    super(t.message, { cause: t.cause }), this.name = "VGPUError", this.code = t.code, this.severity = t.severity ?? "error", this.fix = t.fix, this.where = t.where, this.cause = t.cause, this.detail = t.detail;
  }
};
class M extends mt {
  constructor(t) {
    super({ ...t, severity: "error" }), this.name = "ValidationError";
  }
}
function Br(e) {
  return new mt({
    code: "VGPU-FEATURE-UNSUPPORTED",
    message: `Adapter does not support requested feature(s): ${e.map((t) => `"${t}"`).join(", ")}.`,
    fix: "Remove the unsupported name(s) from init({ requiredFeatures: [...] }) or run on an adapter that supports them; gate optional code paths on device.features after init.",
    where: "init"
  });
}
function zr(e, t) {
  if (!e)
    return;
  const n = (t ?? []).filter((r) => !e.has(r));
  if (n.length)
    throw Br(n);
}
const Wr = {
  map_read: 1,
  map_write: 2,
  copy_src: 4,
  copy_dst: 8,
  index: 16,
  vertex: 32,
  uniform: 64,
  storage: 128,
  indirect: 256,
  query_resolve: 512
};
function Ee(e) {
  const t = globalThis.GPUBufferUsage;
  return e.reduce((n, r) => n | qr(r, t), 0);
}
function qr(e, t) {
  const n = e.toUpperCase();
  return t?.[n] ?? Wr[e];
}
function Gt() {
  return globalThis.GPUMapMode?.READ ?? 1;
}
const jr = {
  copy_src: 1,
  copy_dst: 2,
  texture_binding: 4,
  storage_binding: 8,
  render_attachment: 16
};
function Kr(e) {
  const t = globalThis.GPUTextureUsage;
  return e.reduce((n, r) => n | Hr(r, t), 0);
}
function Hr(e, t) {
  const n = e.toUpperCase();
  return t?.[n] ?? jr[e];
}
function Ln(e) {
  return "__vgpuMockBytes" in e;
}
function Lt(e) {
  return "__vgpuMockBytes" in e;
}
let Yr = 1;
function Ke(e) {
  return Object.freeze({ kind: e, id: Yr++ });
}
class He {
  callbacks = /* @__PURE__ */ new Set();
  destroyed = !1;
  onDestroy(t, n) {
    return this.destroyed ? (n(t), () => {
    }) : (this.callbacks.add(n), () => {
      this.callbacks.delete(n);
    });
  }
  emit(t) {
    if (this.destroyed)
      return !1;
    this.destroyed = !0;
    const n = [...this.callbacks];
    this.callbacks.clear();
    for (const r of n)
      r(t);
    return !0;
  }
}
class j {
  device;
  gpu;
  options;
  ownership;
  destroySignal = new He();
  identity = Ke("buffer");
  destroyed = !1;
  constructor(t, n, r, i = "owned") {
    this.device = t, this.gpu = n, this.options = r, this.ownership = i, Object.defineProperty(this, "assertUsable", { value: (s) => this.#e(s) });
  }
  get resourceIdentity() {
    return this.identity;
  }
  onDestroy(t) {
    return this.destroySignal.onDestroy(this, t);
  }
  #e(t = "Buffer") {
    if (this.destroyed)
      throw new M({
        code: "VGPU-BUFFER-DISPOSED",
        message: "Buffer is destroyed.",
        where: t,
        fix: "Wrap or create a live GPUBuffer before using it."
      });
    this.device.assertUsable(t);
  }
  write(t, n = 0) {
    this.#e("Buffer.write"), this.ownership === "external" && this.validateExternalOperation("write", n, t.byteLength, "copy_dst");
    try {
      this.device.queue.writeBuffer(this.gpu, n, t);
    } catch (r) {
      throw this.ownership !== "external" ? r : Ie("Buffer.write", "The external GPUBuffer rejected the write operation.", r);
    }
  }
  async read(t, n = 0) {
    this.#e("Buffer.read"), this.ownership === "external" && this.validateExternalOperation("read", n, t, "copy_src");
    try {
      const r = await this.device.readback.read(this.gpu, t, n);
      return this.#e("Buffer.read"), r;
    } catch (r) {
      throw r instanceof M || this.ownership !== "external" ? r : Ie("Buffer.read", "The external GPUBuffer rejected the read operation.", r);
    }
  }
  destroy() {
    this.destroyed || (this.destroyed = !0, this.destroySignal.emit(this), this.ownership === "owned" && !Ln(this.gpu) && this.gpu.destroy());
  }
  dispose() {
    this.destroy();
  }
  validateExternalOperation(t, n, r, i) {
    if (!(Number.isSafeInteger(n) && n >= 0 && n % 4 === 0 && Number.isSafeInteger(r) && r >= 0 && r % 4 === 0 && n <= this.options.size && r <= this.options.size - n))
      throw Ie(`Buffer.${t}`, "External buffer offsets and lengths must be non-negative, 4-byte aligned, and within the buffer size.");
    if ((this.gpu.usage & Ee([i])) === 0)
      throw Ie(`Buffer.${t}`, `External buffer is missing ${i.toUpperCase()} usage.`);
  }
}
function Ie(e, t, n) {
  return new M({
    code: "VGPU-EXTERNAL-BUFFER-VALIDATION",
    message: t,
    where: e,
    cause: n,
    fix: "Use a buffer with the required usage flags and an aligned in-range operation."
  });
}
function Xr(e) {
  if (Jr(e))
    throw ei();
  const t = { version: 1, mappings: [] }, n = {
    version: 1,
    modules: [{ path: "<runtime>", text: e }],
    diagnostics: [],
    sourceMap: t,
    cacheKey: Qr(e)
  };
  return {
    kind: "wgsl",
    wgsl: e,
    source: { text: e, path: "<runtime>", imports: [] },
    ast: n,
    sourceMap: t,
    diagnostics: [],
    cacheKey: n.cacheKey,
    entryPoints: Zr(e),
    stats: { lines: e.split(/\r?\n/).length, bytes: new TextEncoder().encode(e).byteLength, bindGroups: 0 }
  };
}
function Qr(e) {
  let t = 2166136261;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619);
  return { default: `vgpu-wgsl-1:${(t >>> 0).toString(16).padStart(8, "0")}` };
}
function Zr(e) {
  const t = [], n = /@(vertex|fragment|compute)\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const r of e.matchAll(n))
    t.push(r[2]);
  return t;
}
function Jr(e) {
  const t = e.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trimStart();
  return t.startsWith("import ") || t.startsWith("import{");
}
function ei() {
  const e = new Error("Runtime WGSL strings cannot contain import statements. Use a build-time loader or @vgpu/wgsl/runtime.");
  return e.name = "VGPUWGSLRuntimeImportError", e.code = "VGPU-WGSL-RUNTIME-IMPORT", e.severity = "error", e.source = "wgsl", e;
}
const ti = /* @__PURE__ */ new Set([
  "alias",
  "break",
  "case",
  "const",
  "const_assert",
  "continue",
  "continuing",
  "default",
  "diagnostic",
  "discard",
  "else",
  "enable",
  "false",
  "fn",
  "for",
  "if",
  "let",
  "loop",
  "override",
  "requires",
  "return",
  "struct",
  "switch",
  "true",
  "var",
  "while"
]), ni = /* @__PURE__ */ new Set(["import", "export", "from", "as"]), Un = /* @__PURE__ */ new Set([...ti, ...ni]), ri = /* @__PURE__ */ new Set([
  "NULL",
  "Self",
  "abstract",
  "active",
  "alignas",
  "alignof",
  "as",
  "asm",
  "asm_fragment",
  "async",
  "attribute",
  "auto",
  "await",
  "become",
  "cast",
  "catch",
  "class",
  "co_await",
  "co_return",
  "co_yield",
  "coherent",
  "column_major",
  "common",
  "compile",
  "compile_fragment",
  "concept",
  "const_cast",
  "consteval",
  "constexpr",
  "constinit",
  "crate",
  "debugger",
  "decltype",
  "delete",
  "demote",
  "demote_to_helper",
  "do",
  "dynamic_cast",
  "enum",
  "explicit",
  "export",
  "extends",
  "extern",
  "external",
  "fallthrough",
  "filter",
  "final",
  "finally",
  "friend",
  "from",
  "fxgroup",
  "get",
  "goto",
  "groupshared",
  "highp",
  "impl",
  "implements",
  "import",
  "inline",
  "instanceof",
  "interface",
  "layout",
  "lowp",
  "macro",
  "macro_rules",
  "match",
  "mediump",
  "meta",
  "mod",
  "module",
  "move",
  "mut",
  "mutable",
  "namespace",
  "new",
  "nil",
  "noexcept",
  "noinline",
  "nointerpolation",
  "non_coherent",
  "noncoherent",
  "noperspective",
  "null",
  "nullptr",
  "of",
  "operator",
  "package",
  "packoffset",
  "partition",
  "pass",
  "patch",
  "pixelfragment",
  "precise",
  "precision",
  "premerge",
  "priv",
  "protected",
  "pub",
  "public",
  "readonly",
  "ref",
  "regardless",
  "register",
  "reinterpret_cast",
  "require",
  "resource",
  "restrict",
  "self",
  "set",
  "shared",
  "sizeof",
  "smooth",
  "snorm",
  "static",
  "static_assert",
  "static_cast",
  "std",
  "subroutine",
  "super",
  "target",
  "template",
  "this",
  "thread_local",
  "throw",
  "trait",
  "try",
  "type",
  "typedef",
  "typeid",
  "typename",
  "typeof",
  "union",
  "unless",
  "unorm",
  "unsafe",
  "unsized",
  "use",
  "using",
  "varying",
  "virtual",
  "volatile",
  "wgsl",
  "where",
  "with",
  "writeonly",
  "yield"
]), ii = /* @__PURE__ */ new Set(["binding_array"]), Ut = Ee(["copy_dst", "map_read"]);
class si {
  device;
  constructor(t) {
    this.device = t;
  }
  async read(t, n, r) {
    if (Ln(t))
      return t.__vgpuMockBytes.slice(r, r + n).buffer;
    const i = this.device.createBuffer({
      size: n,
      usage: Ut
    });
    try {
      const s = this.device.createCommandEncoder();
      s.copyBufferToBuffer(t, r, i, 0, n), this.device.queue.submit([s.finish()]), await i.mapAsync(Gt());
      const o = i.getMappedRange().slice(0);
      return Dt(i), o;
    } finally {
      Mt(i);
    }
  }
  async readTexture(t, n, r) {
    const [i, s] = n, o = Oe(r, "Readback.readTexture"), a = o.bytesPerPixel, c = oi(i * a, 256), u = c * s, d = this.device.createBuffer({ size: u, usage: Ut });
    let f;
    try {
      const h = this.device.createCommandEncoder();
      h.copyTextureToBuffer({ texture: t }, { buffer: d, bytesPerRow: c, rowsPerImage: s }, { width: i, height: s }), this.device.queue.submit([h.finish()]), await d.mapAsync(Gt());
      const p = new Uint8Array(d.getMappedRange());
      f = new Uint8Array(i * s * a);
      for (let w = 0; w < s; w++) {
        const b = w * c, $ = w * i * a;
        f.set(p.subarray(b, b + i * a), $);
      }
      Dt(d);
    } finally {
      Mt(d);
    }
    return o.swizzle === "bgra-to-rgba" && Dn(f), f;
  }
  destroy() {
  }
}
function Dt(e) {
  try {
    e.unmap();
  } catch {
  }
}
function Mt(e) {
  try {
    e.destroy();
  } catch {
  }
}
function oi(e, t) {
  return Math.ceil(e / t) * t;
}
const Vt = {
  r8unorm: { bytesPerPixel: 1, components: 1, componentType: "unorm8" },
  rg8unorm: { bytesPerPixel: 2, components: 2, componentType: "unorm8" },
  rgba8unorm: { bytesPerPixel: 4, components: 4, componentType: "unorm8" },
  "rgba8unorm-srgb": { bytesPerPixel: 4, components: 4, componentType: "unorm8" },
  bgra8unorm: { bytesPerPixel: 4, components: 4, componentType: "unorm8", swizzle: "bgra-to-rgba" },
  "bgra8unorm-srgb": { bytesPerPixel: 4, components: 4, componentType: "unorm8", swizzle: "bgra-to-rgba" },
  r16float: { bytesPerPixel: 2, components: 1, componentType: "float16" },
  rg16float: { bytesPerPixel: 4, components: 2, componentType: "float16" },
  rgba16float: { bytesPerPixel: 8, components: 4, componentType: "float16" },
  r32float: { bytesPerPixel: 4, components: 1, componentType: "float32" },
  rg32float: { bytesPerPixel: 8, components: 2, componentType: "float32" },
  rgba32float: { bytesPerPixel: 16, components: 4, componentType: "float32" }
};
function Oe(e, t) {
  const n = Vt[e];
  if (n)
    return n;
  throw new M({
    code: "VGPU-CORE-UNSUPPORTED-FORMAT",
    message: `Texture.read does not support format ${e}. Supported formats: ${Object.keys(Vt).join(", ")}.`,
    where: t
  });
}
function ai(e, t, n = "Texture.readFloats") {
  const r = Oe(t, n), i = r.bytesPerPixel / r.components, s = Math.floor(e.byteLength / i), o = new Float32Array(s), a = new DataView(e.buffer, e.byteOffset, e.byteLength);
  for (let c = 0; c < s; c++)
    r.componentType === "unorm8" ? o[c] = a.getUint8(c) / 255 : r.componentType === "float16" ? o[c] = ci(a.getUint16(c * 2, !0)) : o[c] = a.getFloat32(c * 4, !0);
  return o;
}
function ci(e) {
  const t = e & 32768 ? -1 : 1, n = e >> 10 & 31, r = e & 1023;
  return n === 0 ? t * r * 2 ** -24 : n === 31 ? r === 0 ? t * Number.POSITIVE_INFINITY : Number.NaN : t * (r + 1024) * 2 ** (n - 25);
}
function ui(e, t, n) {
  const r = e.slice(0, t[0] * t[1] * n.bytesPerPixel);
  return n.swizzle === "bgra-to-rgba" && Dn(r), r;
}
function Dn(e) {
  for (let t = 0; t < e.length; t += 4) {
    const n = e[t];
    e[t] = e[t + 2], e[t + 2] = n;
  }
}
function di(e) {
  return { size: e, usage: Ee(["copy_src", "copy_dst"]) };
}
class fi {
  gpu;
  guard;
  constructor(t, n = () => {
  }) {
    this.gpu = t, this.guard = n;
  }
  writeBuffer(t, n, r) {
    this.guard("Queue.writeBuffer"), this.gpu.writeBuffer(t, n, r);
  }
  async flush() {
    this.guard("Queue.flush"), await this.gpu.onSubmittedWorkDone?.(), this.guard("Queue.flush");
  }
}
class li {
  gpu;
  resolved;
  constructor(t, n) {
    this.gpu = t, this.resolved = n;
  }
  dispose() {
  }
  get kind() {
    return this.resolved.kind;
  }
  get source() {
    return this.resolved.source;
  }
  get code() {
    return this.resolved.wgsl;
  }
  get entryPoints() {
    return this.resolved.entryPoints;
  }
  get stats() {
    return this.resolved.stats;
  }
}
const hi = /* @__PURE__ */ Symbol.for("vgpu/Texture"), pi = /* @__PURE__ */ Symbol.for("vgpu/Texture/resizeLock");
class ce {
  device;
  ownership;
  [hi] = !0;
  destroySignal = new He();
  identity = Ke("texture");
  currentGpu;
  currentOptions;
  defaultView = null;
  resizeLock;
  destroyed = !1;
  constructor(t, n, r, i = "owned") {
    this.device = t, this.ownership = i, this.currentGpu = n, this.currentOptions = r, Object.defineProperty(this, pi, {
      value: (s) => {
        this.resizeLock = s;
      }
    });
  }
  get gpu() {
    return this.currentGpu;
  }
  get options() {
    return this.currentOptions;
  }
  get size() {
    return this.options.size;
  }
  get format() {
    return this.options.format;
  }
  get usage() {
    return this.options.usage;
  }
  get mipLevelCount() {
    return this.options.mipLevelCount ?? 1;
  }
  get sampleCount() {
    return this.options.sampleCount ?? 1;
  }
  get dimension() {
    return this.options.dimension ?? "2d";
  }
  get viewFormats() {
    return this.options.viewFormats ?? [];
  }
  get label() {
    return this.options.label;
  }
  get resourceIdentity() {
    return this.identity;
  }
  onDestroy(t) {
    return this.destroySignal.onDestroy(this, t);
  }
  get view() {
    return this.assertAlive(), this.defaultView ??= this.createView(), this.defaultView;
  }
  createView(t) {
    return this.assertAlive("Texture.createView"), this.gpu.createView(t);
  }
  resize(t) {
    if (this.assertAlive(), this.ownership === "external")
      throw new M({
        code: "VGPU-CORE-EXTERNAL-TEXTURE",
        message: "Texture wraps an externally owned GPUTexture and cannot be resized.",
        where: "Texture.resize"
      });
    if (this.resizeLock)
      throw new M({
        code: "VGPU-CORE-TEXTURE-RESIZE-LOCKED",
        message: this.resizeLock,
        where: "Texture.resize"
      });
    const n = this.options.size[2] ?? 1, r = t[2] ?? n;
    if (this.options.size[0] === t[0] && this.options.size[1] === t[1] && n === r)
      return !1;
    const i = t[2] === void 0 && this.options.size[2] === void 0 ? [t[0], t[1]] : [t[0], t[1], r], s = { ...this.options, size: i }, o = this.gpu;
    return this.currentGpu = this.device.gpu.createTexture(Mn(s)), this.currentOptions = s, this.defaultView = null, o.destroy(), !0;
  }
  /**
   * Raw, unpadded texel bytes in this texture's own format (row stride padding removed).
   * `byteLength` is `width * height * bytesPerPixel(format)`; `bgra*` bytes are swizzled to RGBA order.
   * Use `readFloats()` for float formats to get decoded component values.
   */
  async read() {
    this.assertAlive("Texture.read");
    const t = Oe(this.options.format, "Texture.read");
    if (Lt(this.gpu))
      return ui(this.gpu.__vgpuMockBytes, this.options.size, t);
    const n = await this.device.readback.readTexture(this.gpu, this.options.size, this.options.format);
    return this.assertAlive("Texture.read"), n;
  }
  /**
   * Texel components decoded to f32, row-major, `width * height * components(format)` long.
   * `float16`/`float32` formats keep their HDR values (no clamping); `unorm8` formats are
   * normalized to `[0, 1]` without srgb gamma conversion.
   */
  async readFloats() {
    return Oe(this.options.format, "Texture.readFloats"), ai(await this.read(), this.options.format);
  }
  destroy() {
    this.destroyed || (this.destroyed = !0, this.defaultView = null, this.destroySignal.emit(this), this.ownership !== "external" && (Lt(this.gpu) || this.gpu.destroy()));
  }
  dispose() {
    this.destroy();
  }
  assertAlive(t = "Texture") {
    if (this.destroyed)
      throw new M({ code: "VGPU-CORE-TEXTURE-DESTROYED", message: "Texture is destroyed", where: t });
    this.device.assertUsable?.(t);
  }
}
function Mn(e) {
  const t = {
    label: e.label,
    size: { width: e.size[0], height: e.size[1], depthOrArrayLayers: e.size[2] ?? 1 },
    format: e.format,
    usage: Kr(e.usage)
  };
  return e.mipLevelCount !== void 0 && (t.mipLevelCount = e.mipLevelCount), e.sampleCount !== void 0 && (t.sampleCount = e.sampleCount), e.dimension !== void 0 && (t.dimension = e.dimension), e.viewFormats !== void 0 && (t.viewFormats = [...e.viewFormats]), t;
}
class mi {
  gpu;
  adapterInfo;
  queue;
  /** @internal — use Buffer.read() and Texture.read() instead */
  readback;
  isCompatibilityMode;
  scopes = [];
  ownership;
  state = "alive";
  lossInfo;
  observeLoss = !0;
  constructor(t, n = null, r = "owned", i = {}) {
    this.gpu = t, this.adapterInfo = n, Object.defineProperty(this, "assertUsable", { value: (a) => this.#e(a) }), this.ownership = typeof r == "string" ? r : "owned";
    const s = typeof r == "string" ? i : r;
    this.isCompatibilityMode = s.isCompatibilityMode ?? !1, this.queue = new fi(t.queue, (a) => this.#e(a)), this.readback = new si(t);
    const o = t.lost;
    o && typeof o.then == "function" && Promise.resolve(o).then((a) => {
      !this.observeLoss || this.state !== "alive" || (this.lossInfo = a, this.state = "lost");
    }, () => {
    });
  }
  get limits() {
    return this.#e("Device.limits"), this.gpu.limits;
  }
  get features() {
    return this.#e("Device.features"), this.gpu.features;
  }
  createShader(t) {
    this.#e("Device.createShader");
    const n = typeof t == "string" ? Xr(t) : t;
    return new li(this.gpu.createShaderModule({ code: n.wgsl }), n);
  }
  createTexture(t) {
    return this.#e("Device.createTexture"), new ce(this, this.gpu.createTexture(Mn(t)), t);
  }
  createBuffer(t) {
    this.#e("Device.createBuffer");
    const n = gi(t);
    n && this.captureError(n);
    const r = n ? di(Math.max(4, t.size || 4)) : bi(t);
    return new j(this, this.gpu.createBuffer(r), t);
  }
  /** Wraps a caller-owned GPUBuffer without taking ownership of its native lifetime. */
  wrapBuffer(t) {
    if (this.#e("Device.wrapBuffer"), !yi(t))
      throw new M({
        code: "VGPU-EXTERNAL-BUFFER-INVALID",
        message: "Device.wrapBuffer requires a GPUBuffer with finite size and usage properties.",
        where: "Device.wrapBuffer",
        fix: "Pass a live GPUBuffer created for this GPUDevice."
      });
    const n = {
      size: t.size,
      usage: Si(t.usage),
      ...t.label ? { label: t.label } : {}
    };
    return new j(this, t, n, "external");
  }
  pushErrorScope(t) {
    this.#e("Device.pushErrorScope"), this.scopes.push([]), this.gpu.pushErrorScope?.(t);
  }
  async popErrorScope() {
    this.#e("Device.popErrorScope");
    const t = this.scopes.pop(), n = await this.gpu.popErrorScope?.();
    return this.#e("Device.popErrorScope"), t?.[0] ?? wi(n) ?? null;
  }
  #e(t) {
    if (this.state === "alive")
      return;
    if (this.state === "disposed")
      throw new M({
        code: "VGPU-DEVICE-DISPOSED",
        message: "The GPU device wrapper has been disposed.",
        where: t,
        fix: "Create a new Gpu instance before performing more work."
      });
    const n = this.lossInfo?.reason, r = this.lossInfo?.message;
    throw new M({
      code: "VGPU-DEVICE-LOST",
      message: `The GPU device was lost${n ? ` (${n})` : ""}${r ? `: ${r}` : "."}`,
      where: t,
      cause: this.lossInfo
    });
  }
  destroy() {
    if (this.state === "disposed")
      return;
    const t = this.state === "lost";
    this.state = "disposed", this.observeLoss = !1, this.scopes.length = 0, this.readback.destroy(), this.ownership === "owned" && !t && this.gpu.destroy();
  }
  dispose() {
    this.destroy();
  }
  captureError(t) {
    const n = this.scopes.at(-1);
    if (n)
      n.push(t);
    else
      throw t;
  }
}
function gi(e) {
  return !Number.isFinite(e.size) || e.size <= 0 ? Ot("Buffer size must be greater than zero.") : e.usage.length === 0 ? Ot("Buffer usage must not be empty.") : null;
}
function Ot(e) {
  return new M({ code: "VGPU-CORE-INVALID-USAGE", message: e, where: "Device.createBuffer" });
}
function bi(e) {
  return { label: e.label, size: e.size, usage: Ee(e.usage) };
}
function wi(e) {
  return e ? new M({ code: "VGPU-CORE-VALIDATION", message: e.message, where: "GPUDevice.popErrorScope", cause: e }) : null;
}
function yi(e) {
  if (typeof e != "object" && typeof e != "function" || e === null)
    return !1;
  const t = e;
  return Number.isSafeInteger(t.size) && (t.size ?? -1) >= 0 && Number.isSafeInteger(t.usage) && (t.usage ?? -1) >= 0 && typeof t.destroy == "function";
}
const xi = ["map_read", "map_write", "copy_src", "copy_dst", "index", "vertex", "uniform", "storage", "indirect", "query_resolve"];
function Si(e) {
  return xi.filter((t) => (e & Ee([t])) !== 0);
}
const Vn = /* @__PURE__ */ new WeakMap(), vi = /* @__PURE__ */ new WeakMap();
function Ei(e, t) {
  return Vn.set(e, $i(t)), e;
}
function we(e) {
  return Vn.get(e);
}
function On(e) {
  return vi.get(e);
}
function $i(e) {
  return { entries: e.entries.map((t) => ({ ...t })) };
}
let g = class extends mt {
};
function ki(e, t, n, r, i, s) {
  const o = t === "vertex" ? "Vertex" : "Fragment", a = t === "vertex" ? "VERTEX" : "FRAGMENT", c = `maxStorageBuffersIn${o}Stage`;
  return new g({
    code: `VGPU-LIMIT-STORAGE-${a}`,
    message: `${o} entry '${n}' in '${e}' uses ${r} storage buffer(s), but device limit ${c} is ${i}.`,
    fix: t === "vertex" ? `Request init({ requiredLimits: { ${c}: ${r} } }) if the adapter supports it, or move vertex data to geometry(gpu, ...) vertex streams.` : `Request init({ requiredLimits: { ${c}: ${r} } }) if the adapter supports it, or reduce fragment storage buffers.`,
    where: `${e}.pipelineLayout`,
    detail: { stage: t, entryPoint: n, count: r, limit: i, bindings: s.map(({ name: u, group: d, binding: f }) => ({ name: u, group: d, binding: f })) }
  });
}
function Ii(e, t, n, r, i) {
  return new g({
    code: "VGPU-SET-TEXTURE-FILTERABILITY",
    message: `${r} (${n}) cannot satisfy filtering texture '${t.name}' @group(${t.group}) @binding(${t.binding}).`,
    fix: "Use a filterable format; request float32-filterable for rgba32float when supported; or use textureLoad without a sampler.",
    where: `${e}.set`,
    detail: { format: n, group: t.group, binding: t.binding, bindingName: t.name, resourceName: r, samplerName: i?.name, samplerGroup: i?.group, samplerBinding: i?.binding }
  });
}
function Ti(e, t) {
  const n = es(e, t);
  return new g({
    code: "VGPU-R1-BINDING-NEVER-SET",
    message: `Unset \`${t.name}\` @group(${t.group}) @binding(${t.binding}) in '${e}'. Fix: ${n}; or ${e}.group(${t.group}, bindGroup).`,
    where: `${e}.draw`
  });
}
function Nn(e, t) {
  const n = t === "lib" ? "lib-owned by its first JS set()" : "user-owned by its first resource set()", r = t === "lib" ? `Fix: pass a resource from the start: wave.set({ ${e}: new Uniform(gpu.device, { size: 4 }) }).` : `Fix: pass JS values from the first set(): wave.set({ ${e}: jsValue }).`;
  return new g({
    code: "VGPU-R1-OWNERSHIP-FLIP",
    message: `\`${e}\` is ${n}; ownership cannot change. ${r}`,
    where: "set"
  });
}
function Fi(e, t) {
  return new g({
    code: "VGPU-R4-GROUP-CLAIMED",
    message: `group ${t} of '${e}' is claimed; set() cannot update it.`,
    fix: `Call set() first, or build from ${e}.layout(${t}); pass dynamic offsets to p.draw().`,
    where: `${e}.set`
  });
}
function Pi(e, t, n, r) {
  return new g({
    code: "VGPU-R4-GROUP-INCOMPATIBLE",
    message: `claimed group ${t} in '${e}' is incompatible: ${n}.`,
    fix: `Build from ${e}.layout(${t}, { dynamicOffsets? }) then call ${e}.group(${t}, bindGroup).`,
    where: `${e}.group`,
    cause: r
  });
}
function ae(e, t, n) {
  return new g({
    code: "VGPU-R4-GROUP-VALIDATION",
    message: `WebGPU rejected claimed group ${t} in '${e}'.`,
    fix: `Build from ${e}.layout(${t}); pass offsets via p.draw(draw, { offsets: { ${t}: [...] } }).`,
    where: `${e}.draw`,
    cause: n,
    detail: { drawLabel: e, group: t }
  });
}
function Nt(e, t) {
  return new g({
    code: "VGPU-BLEND-INVALID",
    message: `Invalid blend '${String(t)}' in '${e}'.`,
    fix: 'Use "alpha", "additive", "premultiplied", or { color, alpha? } components.',
    where: "draw"
  });
}
function _t(e, t) {
  return new g({
    code: "VGPU-BLEND-CONSTANT-INVALID",
    message: `Invalid blendConstant in '${e}': ${t}`,
    fix: 'Use [r, g, b, a] finite numbers with a blend whose color or alpha uses "constant"/"one-minus-constant"; omit it to keep the pass default (0, 0, 0, 0).',
    where: "draw"
  });
}
function Bt(e, t) {
  return new g({
    code: "VGPU-WRITEMASK-INVALID",
    message: `Invalid writeMask ${t} in '${e}'.`,
    fix: "Use an array of r/g/b/a; omit it for all channels.",
    where: "draw"
  });
}
function ot(e, t, n = "draw") {
  return new g({
    code: "VGPU-COLORS-INVALID",
    message: `Invalid colors in '${e}': ${t}`,
    fix: "Use one { blend?, writeMask? } or null entry per color attachment of the target, aligned by index; omit colors to apply the top-level blend/writeMask to every attachment.",
    where: n
  });
}
function Ci(e, t) {
  return new g({
    code: "VGPU-CULL-INVALID",
    message: `Invalid cull '${String(t)}' in '${e}'.`,
    fix: 'Use "none", "front", or "back"; omit it for no culling.',
    where: "draw"
  });
}
function Ai(e, t) {
  return new g({
    code: "VGPU-FRONTFACE-INVALID",
    message: `Invalid frontFace '${String(t)}' in '${e}'.`,
    fix: 'Use "ccw" or "cw"; omit it for counter-clockwise.',
    where: "draw"
  });
}
function zt(e, t) {
  return new g({
    code: "VGPU-UNCLIPPED-DEPTH-INVALID",
    message: `Invalid unclippedDepth in '${e}': ${t}`,
    fix: 'Use a boolean. unclippedDepth: true needs the "depth-clip-control" device feature — request it with init({ requiredFeatures: ["depth-clip-control"] }) on an adapter that supports it. Omit the option to keep depth clipping.',
    where: "draw"
  });
}
function O(e, t) {
  return new g({
    code: "VGPU-DEPTH-INVALID",
    message: `Invalid depth in '${e}': ${t}`,
    fix: 'Use false or { write?, compare?, bias?, biasSlopeScale?, biasClamp? }; omit it for { write: true, compare: "less-equal" }.',
    where: "draw"
  });
}
function se(e, t, n = "draw") {
  return new g({
    code: "VGPU-STENCIL-INVALID",
    message: `Invalid stencil in '${e}': ${t}`,
    fix: `Use { front?, back?, readMask?, writeMask?, ref? } with GPUCompareFunction/GPUStencilOperation faces and u32 masks, against a target whose depth format has a stencil aspect (depth: "depth24plus-stencil8"); omit it for WebGPU's pass-through defaults.`,
    where: n
  });
}
function Ge(e, t, n = "draw") {
  return new g({
    code: "VGPU-MULTISAMPLE-INVALID",
    message: `Invalid multisample in '${e}': ${t}`,
    fix: "Use { alphaToCoverage?, mask? }: alphaToCoverage needs a target created with msaa: true, and mask must be an integer in [0, 0xFFFFFFFF] (bits above the target's sampleCount are ignored). Omit multisample for full-coverage defaults.",
    where: n
  });
}
function Te(e, t, n = "draw") {
  return new g({
    code: "VGPU-CONSTANTS-INVALID",
    message: `Invalid constants in '${e}': ${t}`,
    fix: "Key WGSL `override` constants by name, or by the decimal string of N when the declaration has @id(N); values are finite numbers or booleans, converted to the override's WGSL type (bool/i32/u32/f32/f16). Every override without a default value must be provided. Omit constants to keep the WGSL defaults.",
    where: n
  });
}
function Le(e, t, n = "draw") {
  return new g({
    code: "VGPU-ENTRY-INVALID",
    message: `Invalid entry in '${e}': ${t}`,
    fix: "Name an entry point declared in the shader with the matching stage — { vertex?, fragment? } strings for draw, one @compute name string for compute. Omit entry (or a field) to use the first entry point of that stage.",
    where: n
  });
}
function re(e, t, n) {
  return new g({
    code: "VGPU-INDIRECT-INVALID",
    message: `Invalid indirect in '${e}': ${t}`,
    fix: "Pass a storage buffer created with storage(gpu, bytes, { indirect: true }) — bare, or as { buffer, offset? } with a 4-aligned byte offset — sized so the GPU-read arguments fit: 16 bytes for drawIndirect, 20 for drawIndexedIndirect, 12 for dispatchWorkgroupsIndirect. Omit indirect to use CPU-side counts.",
    where: n
  });
}
function Ri() {
  return new g({
    code: "VGPU-PASS-PRESERVE-MSAA",
    message: "clear:false cannot preserve MSAA; use a non-MSAA target.",
    fix: "Use non-MSAA for accumulation.",
    where: "Frame.pass"
  });
}
function Wt(e, t = "expected a number in [0, 1].", n = 'Use 1 (default), or 0 with depth: { compare: "greater" } for reversed-Z.') {
  return new g({
    code: "VGPU-PASS-CLEARDEPTH-INVALID",
    message: `clearDepth received ${String(e)}; ${t}`,
    fix: n,
    where: "Frame.pass"
  });
}
function N(e) {
  return new g({
    code: "VGPU-PASS-VIEWPORT-INVALID",
    message: `Invalid viewport: ${e}`,
    fix: "Use { x?, y?, width, height, minDepth?, maxDepth? } finite numbers within device limits; omit it for the full target.",
    where: "Frame.pass"
  });
}
function et(e) {
  return new g({
    code: "VGPU-PASS-SCISSOR-INVALID",
    message: `Invalid scissor: ${e}`,
    fix: "Use [x, y, width, height] non-negative integers with x + width and y + height within the target's current pixel size; omit it for the full target.",
    where: "Frame.pass"
  });
}
function Gi() {
  return new g({
    code: "VGPU-PASS-PRESERVE-CLEARDEPTH",
    message: "clear:false preserves depth; clearDepth cannot apply.",
    fix: "Remove clearDepth, or let the pass clear.",
    where: "Frame.pass"
  });
}
function qt(e) {
  return new g({
    code: "VGPU-PASS-CLEARSTENCIL-INVALID",
    message: `clearStencil ${e}`,
    fix: `Use an integer in [0, 0xFFFFFFFF] on a target whose depth format has a stencil aspect, e.g. depth: "depth24plus-stencil8"; the value is masked to the stencil aspect's bit width.`,
    where: "Frame.pass"
  });
}
function Li() {
  return new g({
    code: "VGPU-PASS-PRESERVE-CLEARSTENCIL",
    message: "clear:false preserves stencil; clearStencil cannot apply.",
    fix: "Remove clearStencil, or let the pass clear.",
    where: "Frame.pass"
  });
}
function Z(e, t, n = "Frame.pass") {
  return new g({
    code: "VGPU-PASS-DEPTH-READONLY",
    message: `depthReadOnly ${e}`,
    fix: t,
    where: n
  });
}
function Ui() {
  return new g({
    code: "VGPU-PASS-DEPTH-READONLY-MSAA",
    message: `depthReadOnly cannot read an MSAA target's depth: multisampled depth is stored with storeOp "discard", so a read-only pass tests against discarded contents.`,
    fix: "Use a non-MSAA target for read-only depth, or drop depthReadOnly and let the pass own its depth.",
    where: "Frame.pass"
  });
}
function Di(e, t, n = "timer") {
  return new g({
    code: "VGPU-TIMER-INVALID",
    message: `Invalid timer use: ${e}`,
    fix: t,
    where: n
  });
}
function Mi(e, t, n = "visibility") {
  return new g({
    code: "VGPU-VIS-INVALID",
    message: `Invalid visibility use: ${e}`,
    fix: t,
    where: n
  });
}
function Vi() {
  return new g({
    code: "VGPU-QUERY-NO-VISIBILITY",
    message: "occlusion() needs the pass to be opened with a visibility instance; the render pass has no occlusionQuerySet to write into.",
    fix: "Open the pass with f.pass({ target, visibility: vis }, ...) using the visibility(gpu) instance that created the query handle.",
    where: "FramePass.occlusion"
  });
}
function Oi() {
  return new g({
    code: "VGPU-QUERY-NESTED",
    message: "occlusion() cannot nest inside an active occlusion() body; WebGPU allows one active occlusion query per pass at a time.",
    fix: "Encode each occlusion scope sequentially: p.occlusion(a, ...); p.occlusion(b, ...).",
    where: "FramePass.occlusion"
  });
}
function at(e = "Frame.pass") {
  return new g({
    code: "VGPU-TARGET-REQUIRED",
    message: "Target required. Fix: pass surface(gpu, canvas) or target(gpu, { size }) as { target }.",
    where: e
  });
}
function Ni(e, t, n, r) {
  return new g({ code: e, message: `${e}: ${n}`, fix: r, where: t });
}
function gt(e, t) {
  return Ni("VGPU-MESH-RANGE-INVALID", e, t, "Use index ranges for indexed geometries, vertex ranges otherwise, within geometry counts.");
}
function _i(e) {
  return new g({
    code: "VGPU-PIPELINE-LAYOUT-GAP",
    message: `Pipeline bind group ${e} is missing.`,
    fix: "Use consecutive @group() indices starting at 0.",
    where: "pipeline layout"
  });
}
function he(e, t, n) {
  return new g({
    code: "VGPU-COMPILE-FAILED",
    message: "WebGPU pipeline compilation failed.",
    fix: "Check WGSL, vertex layouts, and target signature.",
    where: e,
    cause: t,
    detail: n ? { signature: n } : void 0
  });
}
function jt(e) {
  return new g({
    code: "VGPU-COMPILE-DISPOSED",
    message: "GPU disposed during pipeline compilation.",
    where: e
  });
}
function Fe(e, t) {
  return new g({
    code: "VGPU-COMPILE-SIGNATURE-INVALID",
    message: `Invalid TargetSignature: ${t}`,
    fix: "Pass { colors, depth?, sampleCount?:1|4 } or a Target.",
    where: e
  });
}
function Bi(e) {
  return new g({
    code: "VGPU-TARGET-DEPTH-STENCIL-ONLY",
    message: `depth received '${e}'; stencil-only depth targets are not supported yet.`,
    fix: 'Use a format with a depth aspect such as "depth24plus" or "depth24plus-stencil8".',
    where: "target"
  });
}
function _n() {
  return new g({
    code: "VGPU-TARGET-SIZE-REQUIRED",
    message: "Target size required. Fix: target(gpu, { size: [w,h] }); update surface-derived targets in onResize.",
    where: "target"
  });
}
function Bn(e) {
  return new g({
    code: "VGPU-SURFACE-NOT-IN-FRAME",
    message: "Surface targets are only available inside frame(gpu).",
    fix: "surface passes must run inside frame(gpu, ...); precompile against an offscreen target(gpu, ...) instead",
    where: e
  });
}
function zi() {
  return new g({
    code: "VGPU-SURFACE-CONTEXT",
    message: "Canvas WebGPU context failed. Fix: check navigator.gpu and remove any existing 2d/webgl context.",
    where: "surface"
  });
}
function Wi(e) {
  return new g({
    code: "VGPU-SURFACE-DUPLICATE",
    message: `Canvas already has surface${e ? ` '${e}'` : ""}. Fix: reuse or dispose it.`,
    where: "surface"
  });
}
function qi(e) {
  return new g({
    code: "VGPU-SURFACE-DISPOSED",
    message: `Surface '${e ?? "surface"}' is disposed. Fix: call surface(gpu, canvas).`,
    where: "surface"
  });
}
function ji() {
  return new g({
    code: "VGPU-SURFACE-AUTORESIZE-UNSUPPORTED",
    message: "autoResize needs clientWidth. Fix: call surface.resize([w,h]) for OffscreenCanvas; onResize still fires.",
    where: "surface"
  });
}
function Ki(e) {
  return new g({
    code: "VGPU-SURFACE-RESIZE-REENTRANT",
    message: `Cannot resize this surface${e ? ` '${e}'` : ""} in onResize. Fix: resize derived targets only.`,
    where: "surface.resize"
  });
}
function Hi(e) {
  return new g({
    code: "VGPU-CLEAR-COLOR-INVALID",
    message: `Invalid ${e}: expected four finite numbers.`,
    fix: "Assign [r, g, b, a] or a GPUColor object ({ r, g, b, a }).",
    where: e
  });
}
function Yi(e) {
  return new g({
    code: "VGPU-CLOCK-DELTA-INVALID",
    message: `clock.advance() received ${String(e)}; expected a finite, non-negative number of seconds.`,
    fix: "Pass the elapsed seconds, e.g. clock(gpu).advance(1 / 60); use frame(gpu) alone to advance with wall-clock time.",
    where: "clock.advance"
  });
}
function zn() {
  return new g({
    code: "VGPU-FRAME-REENTRANT",
    message: "Nested frame(gpu) is invalid. Fix: queue work for the next frame.",
    where: "frame"
  });
}
function Kt(e) {
  return new g({
    code: "VGPU-FRAME-CANCELED",
    message: "the frame was canceled; its command encoder was dropped and nothing more can be encoded or submitted on it.",
    fix: "Open a new frame(gpu) for further work; cancel() is the last operation on a frame.",
    where: e
  });
}
function Xi(e) {
  return new g({
    code: "VGPU-FRAME-PASS-ACTIVE",
    message: "the frame cannot be canceled while a pass callback is active.",
    fix: "Return from the frame.pass(...) callback first, then call frame.cancel(); this keeps pass descriptor resources alive until the pass is closed.",
    where: e
  });
}
function Qi(e) {
  return new g({
    code: "VGPU-FRAME-SUBMITTED",
    message: "the frame was already submitted; submitted GPU work cannot be canceled.",
    fix: "Call cancel() only on a frame you decided not to submit; the frame you did submit needs no cleanup.",
    where: e
  });
}
function B(e, t, n) {
  return new g({
    code: "VGPU-R1-BINDING-INCOMPATIBLE-RESOURCE",
    message: `binding \`${e.name}\` @group(${e.group}) @binding(${e.binding}) needs ${t}.`,
    fix: n,
    where: "set"
  });
}
function G(e, t, n) {
  return new g({ code: "VGPU-RING1-UNSUPPORTED", message: t, fix: n, where: e });
}
function Pe(e) {
  return Zi(e) && e.version !== 1 ? new g({
    code: "VGPU-SHADER-SOURCE-INVALID",
    message: `VGPU-SHADER-SOURCE-INVALID: unsupported ShaderSource v${String(e.version)}; expected v1. Fix: update vgpu or regenerate it.`,
    where: "shader source"
  }) : new g({
    code: "VGPU-SHADER-SOURCE-INVALID",
    message: `VGPU-SHADER-SOURCE-INVALID: expected WGSL or { version, wgsl }, got ${Ji(e)}. Fix: configure @vgpu/wgsl loader-vite or loader-webpack.`,
    where: "shader source"
  });
}
function Zi(e) {
  return typeof e == "object" && e !== null && "version" in e;
}
function Ji(e) {
  if (typeof e != "object" || e === null)
    return typeof e;
  try {
    const t = JSON.stringify(e);
    return t.length > 80 ? `${t.slice(0, 77)}...` : t;
  } catch {
    return "object";
  }
}
function es(e, t) {
  switch (t.kind) {
    case "sampler":
      return `${e}.set({${t.name}:sampler(gpu)})`;
    case "texture":
      return `${e}.set({${t.name}:scene.color})`;
    case "buffer":
      return t.addressSpace === "uniform" ? `${e}.set({${t.name}:{ /* values */ }})` : `${e}.set({${t.name}:buffer})`;
    default:
      return `${e}.set({${t.name}:resource})`;
  }
}
const Ht = ["scheduler", "resource", "service"];
function $e(e) {
  return { name: e };
}
const Wn = /* @__PURE__ */ new WeakMap();
function ts(e) {
  const t = Wn.get(e);
  if (!t)
    throw new g({
      code: "VGPU-GPU-FOREIGN",
      message: "This object was not created by init(); it has no vgpu kernel.",
      fix: "Pass the gpu returned by init() from vgpu, vgpu/node or vgpu/mock.",
      where: "gpu"
    });
  return t;
}
class ns {
  device;
  #e = /* @__PURE__ */ new Map();
  #t = new Map(Ht.map((t) => [t, /* @__PURE__ */ new Set()]));
  #n = /* @__PURE__ */ new Set();
  #r = /* @__PURE__ */ new Set();
  #s = /* @__PURE__ */ new Set();
  #i = !1;
  constructor(t) {
    this.device = t;
  }
  get disposed() {
    return this.#i;
  }
  service(t, n) {
    const r = this.#e.get(t);
    if (r !== void 0)
      return r;
    const i = n(this);
    return this.#e.set(t, i), i;
  }
  peekService(t) {
    return this.#e.get(t);
  }
  own(t, n) {
    const r = this.#t.get(t);
    return r.add(n), () => {
      r.delete(n);
    };
  }
  addErrorListener(t) {
    return this.#n.add(t), () => {
      this.#n.delete(t);
    };
  }
  reportError(t) {
    if (this.#i)
      return Promise.resolve();
    const n = Promise.resolve().then(() => {
      const r = [...this.#n];
      if (!r.length) {
        console.error(t);
        return;
      }
      for (const i of r)
        try {
          i(t);
        } catch (s) {
          console.error(s);
        }
    });
    return this.trackDelivery(n);
  }
  trackDelivery(t) {
    const n = Promise.resolve(t).then(() => {
    }, (r) => {
      console.error(r);
    });
    return this.#r.add(n), n.finally(() => this.#r.delete(n)), n;
  }
  registerSettledSource(t) {
    return this.#s.add(t), () => {
      this.#s.delete(t);
    };
  }
  async settled() {
    const t = [
      ...this.#r,
      ...[...this.#s].flatMap((n) => n())
    ];
    await Promise.allSettled(t);
  }
  dispose() {
    if (!this.#i) {
      this.#i = !0;
      for (const t of Ht) {
        const n = this.#t.get(t);
        for (const r of [...n])
          r();
        n.clear();
      }
      this.#e.clear(), this.#s.clear(), this.#n.clear(), this.device.dispose();
    }
  }
}
function rs(e) {
  const t = new ns(e), n = {
    device: e,
    gpu: e.gpu,
    get disposed() {
      return t.disposed;
    },
    onError: (r) => t.addErrorListener(r),
    settled: () => t.settled(),
    dispose: () => {
      t.dispose();
    }
  };
  return Wn.set(n, t), n;
}
async function is(e, t = {}, n) {
  return rs(await ss(e, t, n));
}
async function ss(e, t, n) {
  return t.adapter || n ? (t.adapter ?? n()).requestDevice(t) : os(t);
}
async function os(e) {
  const n = await globalThis.navigator.gpu?.requestAdapter({ powerPreference: e.powerPreference });
  if (!n)
    throw G("init", "navigator.gpu.requestAdapter() returned null.");
  zr(n.features, e.requiredFeatures);
  const r = await n.requestDevice({ requiredFeatures: e.requiredFeatures, requiredLimits: e.requiredLimits });
  return new mi(r, n.info ?? null);
}
function C(e, t) {
  e.assertUsable(t);
}
function Yt(e, t) {
  e.assertUsable(t);
}
const qn = /* @__PURE__ */ Symbol("vgpu.bindingResource");
function as(e) {
  return typeof (typeof e == "object" && e !== null ? e[qn] : void 0) == "function" ? e : void 0;
}
const ct = /* @__PURE__ */ Symbol("vgpu.geometry.layoutResolver");
function ue(e, t) {
  const n = ts(e);
  if (n.disposed)
    throw jn(t);
  return n;
}
function jn(e) {
  return new g({
    code: "VGPU-GPU-DISPOSED",
    message: `${e}() ran after gpu.dispose(); the device and everything it owned are gone.`,
    fix: "Create resources before disposing the gpu, or init() a new one.",
    where: e
  });
}
class Kn extends Error {
  code;
  line;
  column;
  severity;
  metadata;
  relatedDiagnostics;
  /** Actionable remediation text. Forwarded verbatim from the underlying error when there is one. */
  fix;
  /** Coarse origin of the failure (e.g. `"resolveShader"`), mirroring `@vgpu/core`'s `VGPUError`. */
  where;
  cause;
  constructor(t, n, r = 1, i = 1, s = "error") {
    super(n), this.name = "VGPUError", this.code = t, this.line = r, this.column = i, this.severity = s;
  }
}
function cs(e, t, n = {}) {
  const r = new Kn(e, t, n.line ?? 1, n.column ?? 1, n.severity ?? "error");
  return n.fix !== void 0 && (r.fix = n.fix), n.where !== void 0 && (r.where = n.where), n.cause !== void 0 && (r.cause = n.cause), n.metadata !== void 0 && (r.metadata = n.metadata), r;
}
function T(e, t, n = 1, r = 1) {
  return new Kn(e, t, n, r);
}
const us = /* @__PURE__ */ new Set(["fn", "struct", "const", "alias", "var", "override"]);
function ds(e) {
  const t = [], n = [], r = [];
  let i = 0, s = !1, o = 0;
  for (; i < e.length; ) {
    const a = e[i];
    if (a.text === "{") {
      o++, i++;
      continue;
    }
    if (a.text === "}") {
      o = Math.max(0, o - 1), i++;
      continue;
    }
    if (bt(a)) {
      i++;
      continue;
    }
    if (o > 0) {
      i++;
      continue;
    }
    if (a.text === "import") {
      if (s)
        throw T("VGPU-WGSL-IMP-ORDER", "Imports must precede declarations", a.line, a.column);
      const [f, h] = fs(e, i);
      t.push(f), i = h;
      continue;
    }
    if (a.text === "export" && e[i + 1]?.text === "{")
      throw T("VGPU-WGSL-EXP-REEXPORT-CYCLE", "Re-export cycles are not supported", a.line, a.column);
    if (a.text === "@" && e[i + 2]?.text === "export" && e[i + 3]?.text === "@")
      throw T("VGPU-WGSL-EXP-NOTDECL", "Repeated export attributes", a.line, a.column);
    const c = a.text === "export" || a.text === "@" && e[i + 2]?.text === "export", u = c ? ls(e, a.text === "export" ? i + 1 : i + 3) : i, d = e[u];
    if (d && us.has(d.text)) {
      const f = hs(e, u);
      n.push({ name: f, localName: f, kind: d.text }), c && r.push({ name: f, localName: f, kind: d.text }), s = !0, i = u + 1;
      continue;
    }
    i++;
  }
  return { imports: t, exports: r, locals: n };
}
function fs(e, t) {
  let n = t + 1;
  const r = [];
  if (e[n]?.text === "{") {
    for (n++; e[n] && e[n].text !== "}"; ) {
      if (bt(e[n])) {
        n++;
        continue;
      }
      const o = nt(e[n]);
      let a = o;
      n++, e[n]?.text === "as" && (a = nt(e[n + 1]), n += 2), r.push({ imported: o, local: a }), e[n]?.text === "," && n++;
    }
    n++, tt(e[n], "from"), n++;
  } else if (e[n]?.text === "*")
    tt(e[n + 1], "as"), r.push({ imported: "*", local: nt(e[n + 2]), namespace: !0 }), n += 3, tt(e[n], "from"), n++;
  else throw e[n]?.kind === "string" ? T("VGPU-WGSL-IMP-SIDEEFFECT", "Side-effect imports are not supported", e[n].line, e[n].column) : T("VGPU-WGSL-IMP-DEFAULT", "Default imports are not supported", e[n]?.line, e[n]?.column);
  const i = e[n];
  if (i?.kind !== "string")
    throw T("VGPU-WGSL-RES-NOTFOUND", "Import path must be a string", i?.line, i?.column);
  const s = i.text.slice(1, -1);
  return n++, e[n]?.text === ";" && n++, [{ from: s, bindings: r, start: e[t].start, end: e[n - 1].end }, n];
}
function ls(e, t) {
  for (t = Ce(e, t); e[t]?.text === "@"; ) {
    const n = Ce(e, t + 1);
    if (t = Ce(e, n + 1), e[t]?.text === "(") {
      let r = 0;
      do
        e[t]?.text === "(" ? r++ : e[t]?.text === ")" && r--, t++;
      while (e[t] && r > 0);
      t = Ce(e, t);
    }
  }
  return t;
}
function Ce(e, t) {
  for (; e[t] && bt(e[t]); )
    t++;
  return t;
}
function hs(e, t) {
  let n = t + 1;
  if (e[t]?.text === "var" && e[n]?.text === "<")
    for (; e[n] && e[n].text !== ">"; )
      n++;
  for (; n < e.length; n++)
    if (e[n].kind === "ident")
      return e[n].text;
  throw T("VGPU-WGSL-EXP-NOTDECL", "Exported declaration has no name", e[t]?.line, e[t]?.column);
}
function tt(e, t) {
  if (e?.text !== t)
    throw T("VGPU-WGSL-IMP-DEFAULT", `Expected ${t}`, e?.line, e?.column);
}
function nt(e) {
  if (e?.kind !== "ident")
    throw T("VGPU-WGSL-IMP-DEFAULT", "Expected identifier", e?.line, e?.column);
  return e.text;
}
function bt(e) {
  return e.kind === "lineComment" || e.kind === "blockComment";
}
function ps(e, t) {
  return t === "uniform" || t === "storage" ? "buffer" : e.kind === "sampler" ? "sampler" : e.kind === "texture" ? e.textureKind === "texture_external" ? "externalTexture" : "texture" : "unknown";
}
function ms(e, t, n, r, i) {
  if (e === "buffer")
    return gs(t, n, i);
  if (r.kind === "sampler")
    return bs(r);
  if (r.kind === "texture")
    return r.textureKind === "texture_external" ? { kind: "externalTexture", externalTexture: {} } : r.textureKind.startsWith("texture_storage_") ? ws(r) : ys(r);
}
function gs(e, t, n) {
  return { kind: "buffer", buffer: { type: e === "uniform" ? "uniform" : t === "read" ? "read-only-storage" : "storage", hasDynamicOffset: !1, minBindingSize: n?.size } };
}
function bs(e) {
  return { kind: "sampler", sampler: { type: e.comparison ? "comparison" : "filtering" } };
}
function ws(e) {
  return {
    kind: "storageTexture",
    storageTexture: {
      access: Ss(e.access),
      format: e.texelFormat ?? "rgba8unorm",
      viewDimension: Hn(e.dimension)
    }
  };
}
function ys(e) {
  return {
    kind: "texture",
    texture: {
      sampleType: xs(e),
      viewDimension: Hn(e.dimension),
      multisampled: e.dimension === "multisampled_2d" || e.dimension === "depth_multisampled_2d"
    }
  };
}
function xs(e) {
  if (e.textureKind.startsWith("texture_depth_"))
    return "depth";
  const t = e.sampleType;
  return t?.kind === "scalar" && t.name === "i32" ? "sint" : t?.kind === "scalar" && t.name === "u32" ? "uint" : "unfilterable-float";
}
function Hn(e) {
  switch (e) {
    case "1d":
      return "1d";
    case "2d_array":
    case "depth_2d_array":
      return "2d-array";
    case "cube":
    case "depth_cube":
      return "cube";
    case "cube_array":
    case "depth_cube_array":
      return "cube-array";
    case "3d":
      return "3d";
    default:
      return "2d";
  }
}
function Ss(e) {
  return e === "read" ? "read-only" : e === "read_write" ? "read-write" : "write-only";
}
const vs = /* @__PURE__ */ new Set([
  "array",
  "atomic",
  "bool",
  "f16",
  "f32",
  "i32",
  "mat2x2",
  "mat2x3",
  "mat2x4",
  "mat3x2",
  "mat3x3",
  "mat3x4",
  "mat4x2",
  "mat4x3",
  "mat4x4",
  "ptr",
  "sampler",
  "sampler_comparison",
  "texture_1d",
  "texture_2d",
  "texture_2d_array",
  "texture_3d",
  "texture_cube",
  "texture_cube_array",
  "texture_depth_2d",
  "texture_depth_2d_array",
  "texture_depth_cube",
  "texture_depth_cube_array",
  "texture_depth_multisampled_2d",
  "texture_external",
  "texture_multisampled_2d",
  "texture_storage_1d",
  "texture_storage_2d",
  "texture_storage_2d_array",
  "texture_storage_3d",
  "u32",
  "vec2",
  "vec2f",
  "vec2h",
  "vec2i",
  "vec2u",
  "vec3",
  "vec3f",
  "vec3h",
  "vec3i",
  "vec3u",
  "vec4",
  "vec4f",
  "vec4h",
  "vec4i",
  "vec4u"
]), Es = /* @__PURE__ */ new Set([
  "abs",
  "acos",
  "acosh",
  "all",
  "any",
  "arrayLength",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "ceil",
  "clamp",
  "cos",
  "cosh",
  "countLeadingZeros",
  "countOneBits",
  "countTrailingZeros",
  "cross",
  "degrees",
  "determinant",
  "distance",
  "dot",
  "dot4I8Packed",
  "dot4U8Packed",
  "dpdx",
  "dpdxCoarse",
  "dpdxFine",
  "dpdy",
  "dpdyCoarse",
  "dpdyFine",
  "exp",
  "exp2",
  "extractBits",
  "faceForward",
  "firstLeadingBit",
  "firstTrailingBit",
  "floor",
  "fma",
  "fract",
  "frexp",
  "fwidth",
  "fwidthCoarse",
  "fwidthFine",
  "insertBits",
  "inverseSqrt",
  "ldexp",
  "length",
  "log",
  "log2",
  "max",
  "min",
  "mix",
  "modf",
  "normalize",
  "pack2x16float",
  "pack2x16snorm",
  "pack2x16unorm",
  "pack4x8snorm",
  "pack4x8unorm",
  "pack4xI8",
  "pack4xU8",
  "pack4xI8Clamp",
  "pack4xU8Clamp",
  "pow",
  "quantizeToF16",
  "radians",
  "reflect",
  "refract",
  "reverseBits",
  "round",
  "saturate",
  "select",
  "sign",
  "sin",
  "sinh",
  "smoothstep",
  "sqrt",
  "step",
  "storageBarrier",
  "tan",
  "tanh",
  "textureBarrier",
  "textureDimensions",
  "textureGather",
  "textureGatherCompare",
  "textureLoad",
  "textureNumLayers",
  "textureNumLevels",
  "textureNumSamples",
  "textureSample",
  "textureSampleBaseClampToEdge",
  "textureSampleBias",
  "textureSampleCompare",
  "textureSampleCompareLevel",
  "textureSampleGrad",
  "textureSampleLevel",
  "textureStore",
  "transpose",
  "trunc",
  "unpack2x16float",
  "unpack2x16snorm",
  "unpack2x16unorm",
  "unpack4x8snorm",
  "unpack4x8unorm",
  "unpack4xI8",
  "unpack4xU8",
  "workgroupBarrier"
]), $s = /* @__PURE__ */ new Set([
  "frag_depth",
  "front_facing",
  "global_invocation_id",
  "instance_index",
  "local_invocation_id",
  "local_invocation_index",
  "num_workgroups",
  "position",
  "sample_index",
  "sample_mask",
  "subgroup_invocation_id",
  "subgroup_size",
  "vertex_index",
  "workgroup_id"
]), ks = /* @__PURE__ */ new Set([
  "align",
  "binding",
  "blend_src",
  "builtin",
  "compute",
  "diagnostic",
  "fragment",
  "group",
  "id",
  "interpolate",
  "invariant",
  "location",
  "must_use",
  "size",
  "vertex",
  "workgroup_size"
]), Is = /* @__PURE__ */ new Set(["function", "private", "storage", "uniform", "workgroup"]), Ts = /* @__PURE__ */ new Set(["read", "read_write", "write"]), Fs = /* @__PURE__ */ new Set([
  "bgra8unorm",
  "r32float",
  "r32sint",
  "r32uint",
  "rg32float",
  "rg32sint",
  "rg32uint",
  "rgba16float",
  "rgba16sint",
  "rgba16uint",
  "rgba32float",
  "rgba32sint",
  "rgba32uint",
  "rgba8sint",
  "rgba8snorm",
  "rgba8uint",
  "rgba8unorm"
]);
[
  ...Un,
  ...ri,
  ...ii,
  ...vs,
  ...Es,
  ...$s,
  ...ks,
  ...Is,
  ...Ts,
  ...Fs
];
const Ps = "VGPU-WGSL-IDENT-NONASCII", Cs = "https://github.com/vercel-labs/vgpu/issues/294";
function As(e, t) {
  const n = [];
  let r = 0, i = 1, s = 1;
  const o = (c, u, d, f, h) => n.push({ kind: c, text: e.slice(u, d), start: u, end: d, line: f, column: h }), a = () => {
    e[r] === `
` ? (i++, s = 1) : s++, r++;
  };
  for (; r < e.length; ) {
    const c = e[r];
    if (/\s/.test(c)) {
      a();
      continue;
    }
    const u = r, d = i, f = s;
    if (c === "/" && e[r + 1] === "/") {
      for (; r < e.length && e[r] !== `
`; )
        a();
      o("lineComment", u, r, d, f);
      continue;
    }
    if (c === "/" && e[r + 1] === "*") {
      let h = 0;
      for (; r < e.length; ) {
        if (e[r] === "/" && e[r + 1] === "*") {
          h++, a(), a();
          continue;
        }
        if (e[r] === "*" && e[r + 1] === "/") {
          if (h--, a(), a(), h === 0) {
            o("blockComment", u, r, d, f);
            break;
          }
          continue;
        }
        a();
      }
      if (h !== 0)
        throw T("VGPU-WGSL-LEX-UNTERM-COMMENT", "Unterminated block comment", d, f);
      continue;
    }
    if (c === '"' || c === "'") {
      const h = c;
      for (a(); r < e.length && e[r] !== h; ) {
        if (e[r] === `
`)
          throw T("VGPU-WGSL-LEX-UNTERM-STRING", "Unterminated string", d, f);
        e[r] === "\\" && a(), a();
      }
      if (r >= e.length)
        throw T("VGPU-WGSL-LEX-UNTERM-STRING", "Unterminated string", d, f);
      a(), o("string", u, r, d, f);
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      for (; r < e.length && /[A-Za-z0-9_]/.test(e[r]); )
        a();
      const h = e.slice(u, r);
      o(Un.has(h) ? "keyword" : "ident", u, r, d, f);
      continue;
    }
    if (/[0-9]/.test(c) || c === "." && /[0-9]/.test(e[r + 1] ?? "")) {
      for (c === "." && a(); r < e.length; ) {
        const h = e[r];
        if (/[A-Za-z0-9_.]/.test(h)) {
          a();
          continue;
        }
        if ((h === "+" || h === "-") && Gs(e[r - 1]) && /[0-9]/.test(e[r + 1] ?? "")) {
          a();
          continue;
        }
        break;
      }
      o("number", u, r, d, f);
      continue;
    }
    if (c.charCodeAt(0) > 127)
      throw Rs(e, r, i, s, t);
    a(), o("punct", u, r, d, f);
  }
  return n;
}
function Rs(e, t, n, r, i) {
  let s = t;
  for (; s > 0 && Xt(e[s - 1]); )
    s--;
  let o = t + 1;
  for (; o < e.length && Xt(e[o]); )
    o++;
  const a = e.slice(s, o), c = r - (t - s), u = i === void 0 ? "" : ` in ${i}`, d = cs(Ps, `Non-ASCII identifier '${a}'${u} at line ${n} column ${c}; vgpu's WGSL pipeline supports ASCII identifiers only`, { fix: `Rename '${a}' using ASCII letters, digits and '_'. Unicode (XID) identifiers are tracked in ${Cs}`, line: n, column: c });
  return d.range = { file: i, start: { line: n, column: c } }, d;
}
function Xt(e) {
  return e.charCodeAt(0) > 127 || /[A-Za-z0-9_]/.test(e);
}
function Gs(e) {
  return e === "e" || e === "E" || e === "p" || e === "P";
}
const U = (1n << 64n) - 1n, Q = 11400714785074694791n, ge = 14029467366897019727n, Qt = 1609587929392839161n, Yn = 9650029242287828579n, Zt = 2870177450012600261n;
function Ls(e, t = 0n) {
  const n = new TextEncoder().encode(e);
  let r = 0, i;
  if (n.length >= 32) {
    let s = t + Q + ge, o = t + ge, a = t, c = t - Q;
    const u = n.length - 32;
    do
      s = ie(s, pe(n, r)), r += 8, o = ie(o, pe(n, r)), r += 8, a = ie(a, pe(n, r)), r += 8, c = ie(c, pe(n, r)), r += 8;
    while (r <= u);
    i = q(s, 1n) + q(o, 7n) + q(a, 12n) + q(c, 18n), i = Ae(i, s), i = Ae(i, o), i = Ae(i, a), i = Ae(i, c);
  } else
    i = t + Zt;
  for (i = i + BigInt(n.length) & U; r + 8 <= n.length; )
    i ^= ie(0n, pe(n, r)), i = q(i, 27n) * Q + Yn & U, r += 8;
  for (r + 4 <= n.length && (i ^= Us(n, r) * Q & U, i = q(i, 23n) * ge + Qt & U, r += 4); r < n.length; )
    i ^= BigInt(n[r]) * Zt & U, i = q(i, 11n) * Q & U, r++;
  return i ^= i >> 33n, i = i * ge & U, i ^= i >> 29n, i = i * Qt & U, i ^= i >> 32n, i.toString(16).padStart(16, "0");
}
function ie(e, t) {
  return q(e + t * ge & U, 31n) * Q & U;
}
function Ae(e, t) {
  return e ^= ie(0n, t), e * Q + Yn & U;
}
function q(e, t) {
  return (e << t | e >> 64n - t) & U;
}
function pe(e, t) {
  let n = 0n;
  for (let r = 7; r >= 0; r--)
    n = (n << 8n) + BigInt(e[t + r]);
  return n;
}
function Us(e, t) {
  return BigInt(e[t]) | BigInt(e[t + 1]) << 8n | BigInt(e[t + 2]) << 16n | BigInt(e[t + 3]) << 24n;
}
function Ds(e) {
  return Ls(e);
}
function Ms(e) {
  return Ds(e).slice(0, 8);
}
function Vs(e, t) {
  return `_vgsl_${Ms(e)}__${t}`;
}
function L(e, t) {
  const n = e.find((s) => s.name === t);
  if (!n)
    return;
  const r = n.args.map((s) => s.text).join(""), i = Number(r.replace(/[ui]$/, ""));
  return Number.isFinite(i) ? i : void 0;
}
function wt(e) {
  const t = [[]];
  let n = 0, r = 0;
  for (const i of e) {
    if (i.text === "<" ? n++ : i.text === ">" ? n = Math.max(0, n - 1) : i.text === "(" ? r++ : i.text === ")" && (r = Math.max(0, r - 1)), i.text === "," && n === 0 && r === 0) {
      t.push([]);
      continue;
    }
    t[t.length - 1].push(i);
  }
  return t.map(Xn).filter((i) => i.length > 0);
}
function Xn(e) {
  let t = 0, n = e.length;
  for (; t < n && e[t].text === ","; )
    t++;
  for (; n > t && e[n - 1].text === ","; )
    n--;
  return e.slice(t, n);
}
function Os(e) {
  if (e !== void 0 && Qn(e))
    return Number(e.replace(/[ui]$/, ""));
}
function Qn(e) {
  return /^(0|[1-9][0-9]*)([ui])?$/.test(e);
}
function Zn(e) {
  if (e === "read" || e === "write" || e === "read_write")
    return e;
}
function Ns(e) {
  return ["f32", "f16", "i32", "u32", "bool"].find((t) => t === e);
}
function _s(e) {
  return { kind: "scalar", name: e === "f" ? "f32" : e === "h" ? "f16" : e === "i" ? "i32" : "u32" };
}
function Jn(e) {
  return e === "f16" ? 2 : 4;
}
function ee(e, t) {
  return Math.ceil(t / e) * e;
}
function V(e) {
  const t = Xn(e);
  if (t.length === 0)
    throw T("VGPU-WGSL-REFLECT-TYPE", "Expected WGSL type");
  const n = t.map((s) => s.text).join(""), r = Bs(n);
  if (r)
    return r;
  if (t[1]?.text === "<") {
    const s = t[0].text, o = wt(t.slice(2, -1)), a = zs(s, o);
    if (a)
      return a;
  }
  const i = Ws(n);
  return i || qs(n);
}
function Bs(e) {
  const t = Ns(e);
  if (t)
    return { kind: "scalar", name: t };
  const n = e.match(/^vec([234])([fiuh])$/);
  if (n)
    return { kind: "vector", width: Number(n[1]), element: _s(n[2]) };
  const r = e.match(/^mat([234])x([234])([fh])$/);
  if (r) {
    const i = r[3] === "h" ? { kind: "scalar", name: "f16" } : { kind: "scalar", name: "f32" };
    return { kind: "matrix", columns: Number(r[1]), rows: Number(r[2]), element: i };
  }
}
function zs(e, t) {
  if (e === "array") {
    const n = t[1]?.map((i) => i.text).join(""), r = n === void 0 ? void 0 : Os(n);
    return { kind: "array", element: V(t[0] ?? []), count: r, countExpression: n };
  }
  if (e === "atomic")
    return { kind: "atomic", element: V(t[0] ?? []) };
  if (e === "vec2" || e === "vec3" || e === "vec4")
    return { kind: "vector", width: Number(e.slice(3)), element: V(t[0] ?? []) };
  if (/^mat[234]x[234]$/.test(e))
    return { kind: "matrix", columns: Number(e[3]), rows: Number(e[5]), element: V(t[0] ?? []) };
  if (e === "ptr")
    return { kind: "ptr", addressSpace: t[0]?.map((n) => n.text).join("") ?? "", element: V(t[1] ?? []), access: t[2]?.map((n) => n.text).join("") };
  if (e === "sampler")
    return { kind: "sampler", comparison: !1 };
  if (e.startsWith("texture_storage_"))
    return { kind: "texture", textureKind: e, dimension: e.slice(16), texelFormat: t[0]?.map((n) => n.text).join(""), access: Zn(t[1]?.map((n) => n.text).join("")) };
  if (e.startsWith("texture_"))
    return { kind: "texture", textureKind: e, dimension: e.slice(8), sampleType: t[0] ? V(t[0]) : void 0 };
}
function Ws(e) {
  if (e === "sampler" || e === "sampler_comparison")
    return { kind: "sampler", comparison: e === "sampler_comparison" };
  if (e === "texture_external")
    return { kind: "texture", textureKind: e };
  if (e.startsWith("texture_depth_"))
    return { kind: "texture", textureKind: e, dimension: e.slice(8) };
  if (e.startsWith("texture_"))
    return { kind: "texture", textureKind: e, dimension: e.slice(8) };
}
function qs(e) {
  return { kind: "identifier", name: e };
}
function H(e) {
  if (e?.kind !== "ident" && e?.kind !== "keyword")
    throw T("VGPU-WGSL-REFLECT-PARSE", "Expected identifier", e?.line, e?.column);
  return e.text;
}
function te(e, t, n) {
  for (let r = t; r < e.length; r++)
    if (e[r].text === n)
      return r;
  throw T("VGPU-WGSL-REFLECT-PARSE", `Expected ${n}`, e[t]?.line, e[t]?.column);
}
function js(e, t, n, r) {
  for (let i = t; i < n; i++)
    if (e[i].text === r)
      return i;
}
function Ye(e, t, n) {
  let r = 0;
  for (let i = t; i < e.length; i++)
    if ((e[i].text === "{" || e[i].text === "(") && r++, (e[i].text === "}" || e[i].text === ")") && (r = Math.max(0, r - 1)), r === 0 && e[i].text === n)
      return i;
  return e.length;
}
function yt(e, t) {
  const n = e[t].text, r = n === "(" ? ")" : n === "{" ? "}" : ">";
  let i = 0;
  for (let s = t; s < e.length; s++)
    if (e[s].text === n && i++, e[s].text === r && (i--, i === 0))
      return s;
  throw T("VGPU-WGSL-REFLECT-PARSE", `Unclosed ${n}`, e[t]?.line, e[t]?.column);
}
function xt(e, t) {
  const n = [];
  let r = t;
  for (; e[r]?.text === "@"; ) {
    const i = e[r], s = H(e[r + 1]);
    r += 2;
    let o = [];
    if (e[r]?.text === "(") {
      const a = yt(e, r);
      o = e.slice(r + 1, a), r = a + 1;
    }
    n.push({ name: s, args: o, token: i });
  }
  return [n, r];
}
function oe(e) {
  switch (e.kind) {
    case "scalar":
      return e.name;
    case "identifier":
      return e.name;
    case "vector":
      return `vec${e.width}<${oe(e.element)}>`;
    case "matrix":
      return `mat${e.columns}x${e.rows}<${oe(e.element)}>`;
    case "array":
      return `array<${oe(e.element)}${e.count === void 0 ? "" : `,${e.count}`}>`;
    default:
      return e.kind;
  }
}
function Ks(e) {
  const t = e.find((r) => r.name === "workgroup_size");
  if (!t)
    return;
  const n = wt(t.args).map((r) => Number(r.map((i) => i.text).join("")));
  return [n[0] ?? 1, n[1] ?? 1, n[2] ?? 1];
}
function Hs(e, t) {
  if (e[t]?.text !== "<")
    return { after: t };
  const n = te(e, t, ">"), r = wt(e.slice(t + 1, n)).map((i) => i.map((s) => s.text).join(""));
  return { addressSpace: r[0], access: Zn(r[1]), after: n + 1 };
}
function Ys(e) {
  const t = [], n = [], r = [], i = [], s = [], o = [], a = e.tokens.filter((d) => d.kind !== "lineComment" && d.kind !== "blockComment");
  let c = 0, u = 0;
  for (; c < a.length; ) {
    const d = a[c];
    if (d.text === "{") {
      u++, c++;
      continue;
    }
    if (d.text === "}") {
      u = Math.max(0, u - 1), c++;
      continue;
    }
    if (u > 0) {
      c++;
      continue;
    }
    const f = c, [h, p] = xt(a, c);
    c = p, a[c]?.text === "export" && c++;
    const w = a[c]?.text;
    if (w === "enable") {
      a[c + 1]?.kind === "ident" && o.push(a[c + 1].text), c = Ye(a, c, ";") + 1;
      continue;
    }
    if (w === "struct") {
      const b = Xs(e, a, c);
      b.item && t.push(b.item), c = b.next;
      continue;
    }
    if (w === "alias") {
      const b = Qs(e, a, c);
      b.item && n.push(b.item), c = b.next;
      continue;
    }
    if (w === "var") {
      const b = Zs(e, a, c, h);
      b.item && r.push(b.item), c = b.next;
      continue;
    }
    if (w === "fn") {
      const b = Js(e, a, c, h);
      b.item && i.push(b.item), c = b.next;
      continue;
    }
    if (w === "override") {
      const b = to(a, c, h);
      b.item && s.push(b.item), c = b.next;
      continue;
    }
    c = Math.max(f + 1, c + 1);
  }
  return { structs: t, aliases: n, vars: r, entries: i, overrides: s, features: o };
}
function Xs(e, t, n, r) {
  const i = H(t[n + 1]), s = te(t, n + 2, "{"), o = yt(t, s);
  return {
    item: { name: i, originalName: i, mangledName: St(e, i, "struct"), members: no(t.slice(s + 1, o)), path: e.path },
    next: o + 1
  };
}
function Qs(e, t, n, r) {
  const i = H(t[n + 1]), s = te(t, n + 2, "="), o = Ye(t, s + 1, ";");
  return {
    item: { name: i, originalName: i, mangledName: St(e, i, "alias"), target: V(t.slice(s + 1, o)), path: e.path },
    next: o + 1
  };
}
function Zs(e, t, n, r) {
  const { addressSpace: i, access: s, after: o } = Hs(t, n + 1), a = H(t[o]), c = te(t, o + 1, ":"), u = Ye(t, c + 1, ";");
  return {
    item: { path: e.path, name: a, mangledName: ro(r) ? a : St(e, a, "var"), attrs: r, addressSpace: i, access: s, type: V(t.slice(c + 1, u)) },
    next: u + 1
  };
}
function Js(e, t, n, r) {
  const i = H(t[n + 1]), s = r.find((c) => c.name === "vertex" || c.name === "fragment" || c.name === "compute")?.name;
  if (!s)
    return { item: void 0, next: n + 1 };
  const o = te(t, n + 2, "("), a = yt(t, o);
  return { item: { name: i, mangledName: i, stage: s, workgroupSize: Ks(r), path: e.path, params: eo(t.slice(o + 1, a)) }, next: a + 1 };
}
function eo(e) {
  const t = [];
  let n = 0;
  for (; n < e.length; ) {
    const [r, i] = xt(e, n);
    if (n = i, !e[n] || e[n].text === ",") {
      n++;
      continue;
    }
    const s = H(e[n]), o = te(e, n + 1, ":");
    let a = o + 1, c = 0;
    for (; a < e.length && (e[a].text === "<" && c++, e[a].text === ">" && (c = Math.max(0, c - 1)), !(c === 0 && e[a].text === ",")); )
      a++;
    t.push({ name: s, attrs: r, type: V(e.slice(o + 1, a)) }), n = a + 1;
  }
  return t;
}
function to(e, t, n) {
  const r = H(e[t + 1]), i = Ye(e, t + 1, ";"), s = js(e, t + 2, i, "=");
  return { item: { name: r, mangledName: r, id: L(n, "id"), defaultValue: s === void 0 ? void 0 : e.slice(s + 1, i).map((o) => o.text).join("") }, next: i + 1 };
}
function no(e) {
  const t = [];
  let n = 0;
  for (; n < e.length; ) {
    const [r, i] = xt(e, n);
    if (n = i, !e[n] || e[n].text === "," || e[n].text === ";") {
      n++;
      continue;
    }
    const s = H(e[n]), o = te(e, n + 1, ":");
    let a = o + 1, c = 0;
    for (; a < e.length && (e[a].text === "<" && c++, e[a].text === ">" && (c = Math.max(0, c - 1)), !(c === 0 && (e[a].text === "," || e[a].text === ";"))); )
      a++;
    t.push({ name: s, attrs: r, type: V(e.slice(o + 1, a)), align: L(r, "align"), size: L(r, "size") }), n = a + 1;
  }
  return t;
}
function St(e, t, n) {
  return n === "override" ? t : Vs(e.path, t);
}
function ro(e) {
  return L(e, "group") !== void 0 || L(e, "binding") !== void 0;
}
const io = "literal length required for auto layout; use draw.group(n, bg) manual binding", so = "VGPUError: `bool` is not host-shareable in uniform/storage. Fix: use `u32` (0 | 1) → struct Params { enabled: u32 }", er = "use a manual group claim (`draw.group(n, bg)`)";
function oo(e = 1, t = 1) {
  return T("VGPU-WGSL-REFLECT-ARRAY-LENGTH", io, e, t);
}
function tr(e = 1, t = 1) {
  return T("VGPU-WGSL-REFLECT-BOOL-HOST-SHAREABLE", so, e, t);
}
function Ne(e, t, n = 1, r = 1) {
  return T("VGPU-WGSL-REFLECT-UNKNOWN-TYPE", `type '${e}' is unknown in ${t}; ${er}`, n, r);
}
function Jt(e, t, n = 1, r = 1) {
  return T("VGPU-WGSL-REFLECT-NS-TYPE", `type '${e}' is a namespace-member import; use a named import or manual @group(1+) binding`, n, r);
}
function nr(e, t = 1, n = 1) {
  return T("VGPU-WGSL-REFLECT-NON-HOST-SHAREABLE", `Type ${e} is not host-shareable; ${er}`, t, n);
}
const de = "naga-standard";
function ao(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  for (const o of t) {
    const a = /* @__PURE__ */ new Map();
    for (const c of [...o.structs, ...o.aliases])
      a.set(c.originalName, { path: c.path, name: c.originalName, mangledName: c.mangledName, kind: "members" in c ? "struct" : "alias" });
    r.set(o.structs[0]?.path ?? o.aliases[0]?.path ?? o.vars[0]?.path ?? "", a);
  }
  const i = new Map(e.map((o) => [o.path, r.get(o.path) ?? /* @__PURE__ */ new Map()])), s = /* @__PURE__ */ new Map();
  for (const o of e) {
    const a = new Map(i.get(o.path));
    for (const c of o.parsed.imports)
      co(o, c, a, e, i);
    s.set(o.path, a);
  }
  return s;
}
function co(e, t, n, r, i, s) {
  const o = fo(t, e.path, r), a = i.get(o);
  for (const c of t.bindings) {
    if (c.namespace) {
      n.set(c.local, { path: o, name: c.local, mangledName: c.local, kind: "namespace" });
      continue;
    }
    const u = a?.get(c.imported);
    u && n.set(c.local, u);
  }
}
function uo(e, t) {
  const n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  for (const s of e) {
    for (const o of s.structs) {
      const a = {
        name: o.name,
        mangledName: o.mangledName,
        members: o.members.map((c) => ({ name: c.name, type: J(c.type, o.path, t), align: c.align, size: c.size }))
      };
      n.set(o.mangledName, a), i.set(o.mangledName, a);
    }
    for (const o of s.aliases) {
      const a = { name: o.name, mangledName: o.mangledName, target: J(o.target, o.path, t) };
      r.set(o.mangledName, a), i.set(o.mangledName, a);
    }
  }
  return { structs: n, aliases: r, byMangled: i };
}
function J(e, t, n, r) {
  switch (e.kind) {
    case "identifier": {
      const i = e.name.indexOf(".");
      if (i > 0) {
        const o = e.name.slice(0, i);
        if (n.get(t)?.get(o)?.kind === "namespace")
          throw Jt(e.name);
      }
      const s = n.get(t)?.get(e.name);
      if (s?.kind === "namespace")
        throw Jt(e.name);
      if (!s)
        throw Ne(e.name, t);
      return { kind: "identifier", name: s.name, mangledName: s.mangledName };
    }
    case "array":
    case "atomic":
    case "vector":
    case "matrix":
    case "ptr":
      return { ...e, element: J(e.element, t, n) };
    case "texture":
      return { ...e, sampleType: e.sampleType ? J(e.sampleType, t, n) : void 0 };
    default:
      return e;
  }
}
function fe(e, t) {
  if (!t || e.kind !== "identifier")
    return e;
  const n = t.aliases.get(e.mangledName ?? e.name);
  return n ? fe(n.target, t) : e;
}
function ut(e, t) {
  const n = fe(e, t);
  switch (n.kind) {
    case "array":
    case "atomic":
    case "vector":
    case "matrix":
    case "ptr":
      return { ...n, element: ut(n.element, t) };
    case "texture":
      return { ...n, sampleType: n.sampleType ? ut(n.sampleType, t) : void 0 };
    default:
      return n;
  }
}
function fo(e, t, n, r) {
  const i = void 0;
  if (i !== void 0 && n.some((u) => u.path === i))
    return i;
  const s = e.from, o = t.slice(0, t.lastIndexOf("/") + 1), a = s.startsWith("/") ? s : lo(`${o}${s}`);
  return [s, a].find((u) => n.some((d) => d.path === u)) ?? i ?? a;
}
function lo(e) {
  const t = e.startsWith("/"), n = [];
  for (const r of e.split("/"))
    !r || r === "." || (r === ".." ? n.pop() : n.push(r));
  return `${t ? "/" : ""}${n.join("/")}`;
}
function ke(e, t, n = oe(e), r = n, i) {
  const s = i ? ut(e, i) : e;
  return ho(s, t, n, r, i);
}
function ho(e, t, n, r, i) {
  switch (e.kind) {
    case "scalar":
      return po(e, t, n, r);
    case "atomic":
      return mo(e, t, n, r);
    case "vector":
      return go(e, t, n, r, i);
    case "matrix":
      return bo(e, t, n, r, i);
    case "array":
      return wo(e, t, n, r, i);
    case "identifier":
      return xo(e, t, n, r, i);
    default:
      throw nr(oe(e));
  }
}
function po(e, t, n, r) {
  const i = Jn(e.name);
  if (e.name === "bool")
    throw tr();
  return { name: n, mangledName: r, addressSpace: t, layoutMode: de, type: e, align: i, size: i };
}
function mo(e, t, n, r) {
  return { name: n, mangledName: r, addressSpace: t, layoutMode: de, type: e, align: 4, size: 4 };
}
function go(e, t, n, r, i) {
  const o = ke(e.element, t, n, r, i).size ?? 4, a = e.width === 2 ? o * 2 : o * 4;
  return { name: n, mangledName: r, addressSpace: t, layoutMode: de, type: e, align: a, size: o * e.width };
}
function bo(e, t, n, r, i) {
  const s = { kind: "vector", width: e.rows, element: e.element }, o = ke(s, t, `${n}[]`, `${r}[]`, i), a = ee(o.align, o.size ?? 0);
  return { name: n, mangledName: r, addressSpace: t, layoutMode: de, type: e, align: o.align, size: a * e.columns, stride: a, element: o };
}
function wo(e, t, n, r, i) {
  yo(e.countExpression);
  const s = ke(e.element, t, `${n}[]`, `${r}[]`, i), o = ee(xe(e.element, t, i), s.size ?? 0);
  return {
    name: n,
    mangledName: r,
    addressSpace: t,
    layoutMode: de,
    type: e,
    align: xe(e, t, i),
    size: e.count === void 0 ? void 0 : o * e.count,
    stride: o,
    element: s,
    runtimeSized: e.count === void 0
  };
}
function yo(e) {
  if (e !== void 0 && !Qn(e))
    throw oo();
}
function xo(e, t, n, r, i) {
  if (!i)
    throw Ne(e.name, "<unknown>");
  const s = i.structs.get(e.mangledName ?? e.name);
  if (!s)
    throw Ne(e.name, "<unknown>");
  const o = [];
  let a = 0, c = 1;
  for (const d of s.members) {
    const f = So(d, t, a, i);
    o.push(f.member), a = vo(t, d.type, f.offset, f.member.size ?? 0, i), c = Math.max(c, f.member.align);
  }
  const u = $o(t, c);
  return { name: n, mangledName: r, addressSpace: t, layoutMode: de, type: e, align: u, size: ee(u, a), members: o };
}
function So(e, t, n, r) {
  const i = ke(e.type, t, e.name, e.name, r), s = Math.max(xe(e.type, t, r), e.align ?? 1), o = Math.max(i.size ?? 0, e.size ?? 0), a = ee(s, n);
  return {
    member: { name: e.name, offset: a, align: s, size: o, type: e.type, layout: i, explicitAlign: e.align, explicitSize: e.size },
    offset: a
  };
}
function vo(e, t, n, r, i) {
  return n + (e === "uniform" && Eo(t, i) ? ee(16, r) : r);
}
function Eo(e, t) {
  const n = fe(e, t);
  return n.kind === "identifier" && t.structs.has(n.mangledName ?? n.name);
}
function $o(e, t) {
  return e === "uniform" ? ee(16, t) : t;
}
function xe(e, t, n) {
  const r = n ? fe(e, n) : e, i = Ue(r, t, n);
  return t === "uniform" && ko(r, n) ? ee(16, i) : i;
}
function ko(e, t) {
  return e.kind === "array" || e.kind === "identifier" && !!t?.structs.get(e.mangledName ?? e.name);
}
function Ue(e, t, n) {
  const r = n ? fe(e, n) : e;
  switch (r.kind) {
    case "scalar":
      return Io(r.name);
    case "atomic":
      return 4;
    case "vector":
      return r.width === 2 ? Ue(r.element, t, n) * 2 : Ue(r.element, t, n) * 4;
    case "matrix":
      return Ue({ kind: "vector", width: r.rows, element: r.element }, t, n);
    case "array":
      return xe(r.element, t, n);
    case "identifier":
      return To(r, t, n);
    default:
      throw nr(oe(r));
  }
}
function Io(e) {
  if (e === "bool")
    throw tr();
  return Jn(e);
}
function To(e, t, n) {
  const r = n?.structs.get(e.mangledName ?? e.name);
  if (!r)
    throw Ne(e.name, "<unknown>");
  return Math.max(1, ...r.members.map((i) => Math.max(xe(i.type, t, n), i.align ?? 1)));
}
const Fo = /^_vgsl_[0-9a-f]{8,16}__[A-Za-z_][A-Za-z0-9_]*$/, Po = /* @__PURE__ */ new Set(["fn", "struct", "const", "alias", "var", "override"]);
function rr(e) {
  return new Co(e).analyze();
}
class Co {
  tokens;
  scopes = [];
  declarations = [];
  references = [];
  functions = [];
  preserved = /* @__PURE__ */ new Map();
  symbolsByScope = /* @__PURE__ */ new Map();
  moduleFallbackReasons = [];
  pendingSymbols = [];
  moduleScopeId;
  constructor(t) {
    this.tokens = t, this.moduleScopeId = this.createScope("module", void 0, void 0, 0);
  }
  analyze() {
    this.collectTopLevel();
    for (const t of this.functions)
      this.walkFunction(t);
    return {
      tokens: this.tokens,
      scopes: this.scopes,
      declarations: this.declarations,
      references: this.references,
      functions: this.functions,
      preservedTokens: [...this.preserved.entries()].map(([t, n]) => ({ tokenIndex: t, reason: n })),
      fallback: { wholeModule: this.moduleFallbackReasons.length > 0, reasons: this.moduleFallbackReasons }
    };
  }
  collectTopLevel() {
    let t = 0;
    for (let n = 0; n < this.tokens.length; n++) {
      const r = this.tokens[n];
      if (!_(r)) {
        if (r.text === "{") {
          t++;
          continue;
        }
        if (r.text === "}") {
          t--, t < 0 && (this.moduleFallback("unmatched top-level closing brace", n), t = 0);
          continue;
        }
        if (t === 0) {
          if (r.text === "@") {
            n = this.preserveAttribute(n);
            continue;
          }
          if (r.text === "enable" || r.text === "requires" || r.text === "diagnostic" || r.text === "const_assert") {
            n = this.preserveStatement(n, "directive");
            continue;
          }
          if (r.text !== "export") {
            if (r.text === "struct") {
              n = this.collectStruct(n);
              continue;
            }
            if (r.text === "fn") {
              n = this.collectFunction(n);
              continue;
            }
            if (r.text === "const" || r.text === "alias" || r.text === "var" || r.text === "override") {
              n = this.preserveGlobalDeclaration(n);
              continue;
            }
            r.kind === "keyword" && !Po.has(r.text) && this.moduleFallback(`unexpected top-level keyword '${r.text}'`, n);
          }
        }
      }
    }
    t !== 0 && this.moduleFallback("unclosed top-level brace", this.tokens.length - 1), this.scopes[this.moduleScopeId].endToken = Math.max(0, this.tokens.length - 1);
  }
  collectStruct(t) {
    const n = this.nextSig(t);
    if (n === void 0 || this.tokens[n]?.kind !== "ident")
      return this.moduleFallback("struct without name", t), t;
    this.preserveToken(n, "global");
    const r = this.nextSig(n);
    if (r === void 0 || this.tokens[r]?.text !== "{")
      return this.moduleFallback("struct without body", t), n;
    const i = this.findMatching(r, "{", "}");
    if (i === void 0)
      return this.moduleFallback("unclosed struct body", r), r;
    for (let s = r; s <= i; s++)
      this.tokens[s]?.kind === "ident" && this.preserveToken(s, "struct");
    return i;
  }
  collectFunction(t) {
    const n = this.nextSig(t);
    if (n === void 0 || this.tokens[n]?.kind !== "ident")
      return this.moduleFallback("function without name", t), t;
    const r = this.tokens[n].text, i = Fo.test(r) && !this.hasEntryAttributeBefore(t);
    this.addDeclaration(r, "function", n, this.moduleScopeId, void 0, i), i || this.preserveToken(n, "global");
    const s = this.nextSig(n);
    if (s === void 0 || this.tokens[s]?.text !== "(")
      return this.moduleFallback("function without parameter list", n), n;
    const o = this.findMatching(s, "(", ")");
    if (o === void 0)
      return this.moduleFallback("unclosed function parameter list", s), s;
    const a = this.findNextText(o + 1, "{");
    if (a === void 0)
      return this.moduleFallback("function without body", o), o;
    this.preserveFunctionSignatureTail(o + 1, a);
    const c = this.findMatching(a, "{", "}");
    if (c === void 0)
      return this.moduleFallback("unclosed function body", a), a;
    const u = this.createScope("function", this.moduleScopeId, this.functions.length, s);
    return this.functions.push({ id: this.functions.length, name: r, nameTokenIndex: n, scopeId: u, bodyStartToken: a, bodyEndToken: c, skipped: !1, fallbackReasons: [] }), this.collectParams(s, o, u, this.functions.length - 1), this.scopes[u].endToken = c, c;
  }
  collectParams(t, n, r, i) {
    for (let s = t + 1; s < n; s++) {
      const o = this.tokens[s];
      if (!_(o)) {
        if (o.text === "@") {
          s = this.preserveAttribute(s);
          continue;
        }
        if (o.kind === "ident" && this.nextSig(s) !== void 0 && this.tokens[this.nextSig(s)]?.text === ":") {
          this.addDeclaration(o.text, "param", s, r, i, !0);
          const a = this.nextSig(s);
          s = this.preserveTypeFrom(a + 1, [",", ")"], n);
        }
      }
    }
  }
  preserveFunctionSignatureTail(t, n) {
    for (let r = t; r < n; r++) {
      const i = this.tokens[r];
      if (!_(i)) {
        if (i.text === "@") {
          r = this.preserveAttribute(r);
          continue;
        }
        i.kind === "ident" && this.preserveToken(r, "type");
      }
    }
  }
  preserveGlobalDeclaration(t) {
    let n = t + 1;
    if (this.tokens[t]?.text === "var") {
      const s = this.nextSig(t);
      if (s !== void 0 && this.tokens[s]?.text === "<") {
        const o = this.findMatching(s, "<", ">");
        if (o === void 0)
          return this.moduleFallback("unparseable top-level var template", s), s;
        this.preserveRange(s, o, "type"), n = o + 1;
      }
    }
    const r = this.findNextIdent(n);
    r !== void 0 && (this.preserveToken(r, "global"), this.addDeclaration(this.tokens[r].text, "global", r, this.moduleScopeId, void 0, !1));
    const i = this.findStatementEnd(t);
    for (let s = t; s <= i; s++)
      this.tokens[s]?.kind === "ident" && this.preserveToken(s, "global");
    return i;
  }
  walkFunction(t) {
    const n = [this.moduleScopeId, t.scopeId], r = [], i = (a, c) => {
      const u = this.createScope(a, n[n.length - 1], t.id, c);
      return n.push(u), u;
    }, s = (a) => {
      if (n.length <= 2) {
        this.functionFallback(t, "scope frame underflow", a);
        return;
      }
      const c = n.pop();
      return this.scopes[c].endToken = a, c;
    };
    i("block", t.bodyStartToken);
    let o = 1;
    for (let a = t.bodyStartToken + 1; a < t.bodyEndToken; a++) {
      this.activatePendingSymbols(a);
      const c = this.tokens[a];
      if (_(c))
        continue;
      if (c.text === "@") {
        a = this.preserveAttribute(a);
        continue;
      }
      if (c.text === ".") {
        const d = this.nextSig(a);
        d !== void 0 && this.tokens[d]?.kind === "ident" && this.preserveToken(d, "member");
        continue;
      }
      if (c.text === "enable" || c.text === "requires" || c.text === "diagnostic") {
        a = this.preserveStatement(a, "directive");
        continue;
      }
      if (c.text === "for") {
        const d = i("for-init", a), f = this.nextSig(a);
        (f === void 0 || this.tokens[f]?.text !== "(") && this.functionFallback(t, "for without parenthesized header", a), r.push({ scopeId: d, headerDepth: 0, awaitingBody: !1 });
        continue;
      }
      const u = r[r.length - 1];
      if (u && u.bodyDepth === void 0 && (c.text === "(" && u.headerDepth++, c.text === ")" && (u.headerDepth--, u.headerDepth <= 0 && (u.awaitingBody = !0))), c.text === "{") {
        o++;
        const d = Ao(r, (f) => f.awaitingBody && f.bodyDepth === void 0);
        d && (d.bodyDepth = o), i("block", a);
        continue;
      }
      if (c.text === "}") {
        const d = o;
        for (s(a), o--; r.length > 0 && r[r.length - 1].bodyDepth === d; )
          s(a), r.pop();
        o < 0 && this.functionFallback(t, "unmatched closing brace", a);
        continue;
      }
      if (c.text === ":") {
        a = this.preserveTypeFrom(a + 1, ["=", ";", ",", ")", "{"], t.bodyEndToken);
        continue;
      }
      if (c.text === "-" && this.tokens[this.nextSig(a) ?? -1]?.text === ">") {
        a = this.preserveTypeFrom((this.nextSig(a) ?? a) + 1, ["{"], t.bodyEndToken);
        continue;
      }
      if (c.text === "let" || c.text === "const" || c.text === "var") {
        a = this.collectLocalDeclaration(a, n[n.length - 1], t);
        continue;
      }
      if (c.kind === "ident" && !this.preserved.has(a)) {
        const d = this.resolve(c.text, n);
        d !== void 0 ? this.references.push({ name: c.text, tokenIndex: a, declarationId: d, scopeId: n[n.length - 1], functionId: t.id }) : this.preserveToken(a, "unknown");
      }
    }
    for (; n.length > 2; )
      s(t.bodyEndToken);
  }
  collectLocalDeclaration(t, n, r) {
    const i = this.tokens[t].text;
    let s = t + 1;
    if (i === "var") {
      const c = this.nextSig(t);
      if (c !== void 0 && this.tokens[c]?.text === "<") {
        const u = this.findMatching(c, "<", ">");
        if (u === void 0)
          return this.functionFallback(r, "unparseable var template", c), c;
        this.preserveRange(c, u, "type"), s = u + 1;
      }
    }
    const o = this.findNextIdent(s);
    if (o === void 0 || o >= r.bodyEndToken)
      return this.functionFallback(r, `${i} without identifier`, t), t;
    this.addDeclaration(this.tokens[o].text, i, o, n, r.id, !0, this.findStatementEnd(t));
    const a = this.nextSig(o);
    return a !== void 0 && this.tokens[a]?.text === ":" ? this.preserveTypeFrom(a + 1, ["=", ";", ",", ")"], r.bodyEndToken) : o;
  }
  addDeclaration(t, n, r, i, s, o, a) {
    const c = this.declarations.length;
    return this.declarations.push({ id: c, name: t, kind: n, tokenIndex: r, scopeId: i, functionId: s, safeToRename: o }), a !== void 0 ? this.pendingSymbols.push({ name: t, id: c, scopeId: i, activateAfter: a }) : this.activateSymbol(t, c, i), c;
  }
  activatePendingSymbols(t) {
    for (let n = this.pendingSymbols.length - 1; n >= 0; n--) {
      const r = this.pendingSymbols[n];
      r.activateAfter >= t || (this.activateSymbol(r.name, r.id, r.scopeId), this.pendingSymbols.splice(n, 1));
    }
  }
  activateSymbol(t, n, r) {
    let i = this.symbolsByScope.get(r);
    i || (i = /* @__PURE__ */ new Map(), this.symbolsByScope.set(r, i)), i.has(t) || i.set(t, n);
  }
  resolve(t, n) {
    for (let r = n.length - 1; r >= 0; r--) {
      const i = this.symbolsByScope.get(n[r])?.get(t);
      if (i !== void 0)
        return i;
    }
  }
  preserveAttribute(t) {
    this.preserveToken(t, "attribute");
    const n = this.nextSig(t);
    if (n === void 0)
      return t;
    this.preserveToken(n, "attribute");
    const r = this.nextSig(n);
    if (r === void 0 || this.tokens[r]?.text !== "(")
      return n;
    const i = this.findMatching(r, "(", ")");
    return i === void 0 ? (this.preserveRange(r, r, "attribute"), r) : (this.preserveRange(r, i, "attribute"), i);
  }
  preserveTypeFrom(t, n, r) {
    let i = 0, s = 0, o = 0, a = t - 1;
    for (let c = t; c < r; c++) {
      const u = this.tokens[c];
      if (!_(u)) {
        if (i === 0 && s === 0 && o === 0 && n.includes(u.text))
          return Math.max(t - 1, c - 1);
        if (u.text === "<")
          i++;
        else if (u.text === ">")
          i = Math.max(0, i - 1);
        else if (u.text === "(")
          s++;
        else if (u.text === ")") {
          if (s === 0 && n.includes(")"))
            return Math.max(t - 1, c - 1);
          s = Math.max(0, s - 1);
        } else u.text === "[" ? o++ : u.text === "]" && (o = Math.max(0, o - 1));
        u.kind === "ident" && this.preserveToken(c, "type"), a = c;
      }
    }
    return a;
  }
  preserveStatement(t, n) {
    const r = this.findStatementEnd(t);
    return this.preserveRange(t, r, n), r;
  }
  preserveRange(t, n, r) {
    for (let i = t; i <= n; i++)
      this.tokens[i] && this.tokens[i].kind !== "lineComment" && this.tokens[i].kind !== "blockComment" && this.preserveToken(i, r);
  }
  preserveToken(t, n) {
    this.preserved.has(t) || this.preserved.set(t, n);
  }
  createScope(t, n, r, i) {
    const s = this.scopes.length;
    return this.scopes.push({ id: s, kind: t, parentId: n, functionId: r, startToken: i }), s;
  }
  nextSig(t) {
    for (let n = t + 1; n < this.tokens.length; n++)
      if (!_(this.tokens[n]))
        return n;
  }
  findNextIdent(t) {
    for (let n = t; n < this.tokens.length; n++) {
      const r = this.tokens[n];
      if (!_(r)) {
        if (r.kind === "ident")
          return n;
        if (r.text !== "@")
          return;
      }
    }
  }
  findNextText(t, n) {
    for (let r = t; r < this.tokens.length; r++)
      if (!_(this.tokens[r]) && this.tokens[r].text === n)
        return r;
  }
  // `<` / `>` are deliberately not tracked here: in a declaration's initializer they are
  // comparison or shift operators, not template brackets, and a net-positive count made this scan
  // overshoot the statement's own `;` (vgpu#251). A WGSL template argument list can never contain
  // `;`, `{` or `}`, so angle depth is not load-bearing for finding a statement end.
  findStatementEnd(t) {
    let n = 0;
    for (let r = t; r < this.tokens.length; r++) {
      const i = this.tokens[r].text;
      if (i === "(")
        n++;
      else if (i === ")")
        n = Math.max(0, n - 1);
      else if (n === 0 && (i === ";" || i === "{" || i === "}"))
        return r;
    }
    return this.tokens.length - 1;
  }
  findMatching(t, n, r) {
    let i = 0;
    for (let s = t; s < this.tokens.length; s++) {
      const o = this.tokens[s].text;
      if (o === n && i++, o === r && (i--, i === 0))
        return s;
    }
  }
  hasEntryAttributeBefore(t) {
    for (let n = t - 1; n >= 0; n--) {
      const r = this.tokens[n];
      if (!_(r)) {
        if (r.text === ")" || r.kind === "ident" || r.text === "@") {
          const i = r.text;
          if (i === "compute" || i === "vertex" || i === "fragment")
            return !0;
          continue;
        }
        break;
      }
    }
    return !1;
  }
  moduleFallback(t, n) {
    this.moduleFallbackReasons.push(`${t} at token ${n}`);
  }
  functionFallback(t, n, r) {
    t.skipped = !0, t.fallbackReasons.push(`${n} at token ${r}`);
  }
}
function Ao(e, t) {
  for (let n = e.length - 1; n >= 0; n--)
    if (t(e[n]))
      return e[n];
}
function _(e) {
  return e.kind === "lineComment" || e.kind === "blockComment";
}
const Ro = /* @__PURE__ */ new Set(["textureSample", "textureSampleBias", "textureSampleLevel", "textureSampleGrad", "textureGather", "textureSampleBaseClampToEdge"]), Go = /* @__PURE__ */ new Set(["textureSampleCompare", "textureSampleCompareLevel", "textureGatherCompare"]);
function Lo(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.length; i++) {
    const s = e[i], o = t[i], a = rr(s.tokens), c = /* @__PURE__ */ new Map();
    for (const d of o.vars) {
      const f = L(d.attrs, "group"), h = L(d.attrs, "binding"), p = a.declarations.find((w) => w.kind === "global" && w.name === d.name);
      f !== void 0 && h !== void 0 && p && c.set(p.id, { group: f, binding: h });
    }
    const u = /* @__PURE__ */ new Map();
    for (const d of a.declarations) {
      if (d.kind !== "function")
        continue;
      const f = a.functions.find((h) => h.nameTokenIndex === d.tokenIndex);
      f && u.set(d.id, f.id);
    }
    for (const d of o.entries) {
      const f = a.functions.find((b) => b.name === d.name), h = [];
      let p = a.fallback.wholeModule || !f;
      !p && f && (p = !ir(f.id, /* @__PURE__ */ new Map(), /* @__PURE__ */ new Set(), a, c, u, h));
      const w = f ? Oo(f.id, a, c, u) : n.map(dt);
      r.set(d, p ? No(n, w) : _o(h));
    }
  }
  return r;
}
function ir(e, t, n, r, i, s, o) {
  const a = r.functions[e];
  if (!a || a.skipped)
    return !1;
  const c = `${e}|${[...t].map(([f, h]) => `${f}:${h.group}:${h.binding}`).join(",")}`;
  if (n.has(c))
    return !0;
  n.add(c);
  const u = r.references.filter((f) => f.functionId === e), d = new Map(u.map((f) => [f.tokenIndex, f]));
  for (let f = a.bodyStartToken + 1; f < a.bodyEndToken; f++) {
    const h = r.tokens[f]?.text, p = Ro.has(h ?? "") ? "filtering" : Go.has(h ?? "") ? "comparison" : void 0, w = d.get(f), b = w && s.get(w.declarationId);
    if (!p && b === void 0)
      continue;
    const $ = Vo(r, f);
    if ($ === void 0 || r.tokens[$]?.text !== "(")
      continue;
    const I = Mo(r, $);
    if (!I)
      return !1;
    const y = I.map(([v, A]) => Uo(v, A, r, i, t));
    if (p) {
      const v = h === "textureGather" && !Do(I[0], r, i, t) ? 1 : 0, A = y[v], F = y[v + 1];
      if (!A || !F)
        return !1;
      o.push({ texture: A, sampler: F, mode: p });
    } else {
      const v = r.declarations.filter((F) => F.kind === "param" && F.functionId === b).sort((F, Y) => F.tokenIndex - Y.tokenIndex), A = /* @__PURE__ */ new Map();
      for (let F = 0; F < v.length; F++)
        y[F] && A.set(v[F].id, y[F]);
      if (!ir(b, A, n, r, i, s, o))
        return !1;
    }
  }
  return !0;
}
function Uo(e, t, n, r, i) {
  for (const s of n.references) {
    if (s.tokenIndex < e || s.tokenIndex > t)
      continue;
    const o = r.get(s.declarationId) ?? i.get(s.declarationId);
    if (o)
      return o;
  }
}
function Do(e, t, n, r) {
  const i = t.references.find((s) => s.tokenIndex >= e[0] && s.tokenIndex <= e[1]);
  return i?.tokenIndex === e[0] ? n.get(i.declarationId) ?? r.get(i.declarationId) : void 0;
}
function Mo(e, t) {
  const n = [];
  let r = 1, i = 0, s = 0, o = 0, a = t + 1;
  for (let c = t + 1; c < e.tokens.length; c++) {
    const u = e.tokens[c].text;
    if (u === "(")
      r++;
    else if (u === ")") {
      if (r--, r === 0)
        return n.push([a, c - 1]), n;
    } else u === "[" ? i++ : u === "]" ? i-- : u === "{" ? s++ : u === "}" ? s-- : u === "<" ? o++ : u === ">" ? o-- : u === "," && r === 1 && i === 0 && s === 0 && o === 0 && (n.push([a, c - 1]), a = c + 1);
  }
}
function Vo(e, t) {
  for (let n = t + 1; n < e.tokens.length; n++)
    if (e.tokens[n].kind !== "lineComment" && e.tokens[n].kind !== "blockComment")
      return n;
}
function Oo(e, t, n, r) {
  const i = [e], s = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map();
  for (; i.length; ) {
    const a = i.pop();
    if (!s.has(a)) {
      s.add(a);
      for (const c of t.references) {
        if (c.functionId !== a)
          continue;
        const u = n.get(c.declarationId);
        u && o.set(`${u.group}:${u.binding}`, u);
        const d = r.get(c.declarationId);
        d !== void 0 && i.push(d);
      }
    }
  }
  return [...o.values()];
}
function No(e, t) {
  const n = new Set(t.map((o) => `${o.group}:${o.binding}`)), r = e.filter((o) => n.has(`${o.group}:${o.binding}`)), i = r.filter((o) => o.bindingLayout?.kind === "texture" && o.bindingLayout.texture.sampleType === "unfilterable-float" && !o.bindingLayout.texture.multisampled), s = r.filter((o) => o.bindingLayout?.kind === "sampler" && o.bindingLayout.sampler.type === "filtering");
  return i.flatMap((o) => s.map((a) => ({ texture: dt(o), sampler: dt(a), mode: "filtering" })));
}
function dt(e) {
  return { group: e.group, binding: e.binding };
}
function _o(e) {
  const t = /* @__PURE__ */ new Set();
  return e.filter((n) => {
    const r = `${n.texture.group}:${n.texture.binding}:${n.sampler.group}:${n.sampler.binding}:${n.mode}`;
    return t.has(r) ? !1 : (t.add(r), !0);
  });
}
function Bo(e, t) {
  const n = e.map(Ys), r = ao(e, n), i = uo(n, r), s = [], o = [];
  for (const u of n)
    for (const d of u.vars) {
      const f = L(d.attrs, "group"), h = L(d.attrs, "binding");
      if (f === void 0 || h === void 0)
        continue;
      const p = J(d.type, d.path, r), w = ps(p, d.addressSpace), b = d.addressSpace === "uniform" || d.addressSpace === "storage" ? ke(p, d.addressSpace, d.name, d.mangledName, i) : void 0;
      b && o.push(b), s.push({
        group: f,
        binding: h,
        name: d.name,
        mangledName: d.mangledName,
        type: p,
        kind: w,
        addressSpace: d.addressSpace,
        access: d.access,
        struct: p.kind === "identifier" ? i.structs.get(p.mangledName ?? p.name) : void 0,
        layout: b,
        bindingLayout: ms(w, d.addressSpace, d.access, p, b)
      });
    }
  s.sort((u, d) => u.group - d.group || u.binding - d.binding);
  const a = zo(e, n, s), c = Lo(e, n, s);
  return {
    bindings: s,
    entryPoints: n.flatMap((u) => u.entries.map((d) => Wo(d, n.flatMap((f) => f.structs), r, i, a.get(d) ?? s, c.get(d) ?? []))),
    overrides: n.flatMap((u) => u.overrides),
    featuresRequired: [...new Set(n.flatMap((u) => u.features))],
    aliases: [...i.aliases.values()],
    structs: [...i.structs.values()],
    hostShareableLayouts: o
  };
}
function zo(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.length; i++) {
    const s = e[i], o = t[i], a = rr(s.tokens), c = a.fallback.wholeModule, u = /* @__PURE__ */ new Map();
    for (const f of a.declarations) {
      if (f.kind !== "function")
        continue;
      const h = a.functions.find((p) => p.nameTokenIndex === f.tokenIndex);
      h && u.set(f.id, h.id);
    }
    const d = /* @__PURE__ */ new Map();
    for (const f of o.vars) {
      const h = L(f.attrs, "group"), p = L(f.attrs, "binding");
      if (h === void 0 || p === void 0)
        continue;
      const w = a.declarations.find((b) => b.kind === "global" && b.name === f.name);
      w && d.set(w.id, { group: h, binding: p });
    }
    for (const f of o.entries) {
      const h = a.functions.find(($) => $.name === f.name);
      if (c || !h) {
        r.set(f, n);
        continue;
      }
      const p = [h.id], w = /* @__PURE__ */ new Set(), b = /* @__PURE__ */ new Map();
      for (; p.length; ) {
        const $ = p.pop();
        if (!w.has($) && (w.add($), !!a.functions[$]))
          for (const I of a.references) {
            if (I.functionId !== $)
              continue;
            const y = d.get(I.declarationId);
            y && b.set(`${y.group}:${y.binding}`, y);
            const v = u.get(I.declarationId);
            v !== void 0 && p.push(v);
          }
      }
      r.set(f, [...b.values()].sort(($, I) => $.group - I.group || $.binding - I.binding));
    }
  }
  return r;
}
function Wo(e, t, n, r, i, s) {
  return {
    name: e.name,
    mangledName: e.mangledName,
    stage: e.stage,
    // `workgroupSize` and `inputs` stay absent rather than `undefined`-valued when they do not
    // apply: an own key valued `undefined` survives structuredClone but is dropped by
    // JSON.stringify, which would make the key set differ across serialization boundaries.
    ...e.workgroupSize ? { workgroupSize: e.workgroupSize } : {},
    bindings: i.map(({ group: o, binding: a }) => ({ group: o, binding: a })),
    samplingPairs: s,
    ...e.stage === "vertex" ? { inputs: qo(e, t, n, r) } : {}
  };
}
function qo(e, t, n, r) {
  const i = [];
  for (const s of e.params) {
    if (en(s.attrs, "builtin"))
      continue;
    const o = J(s.type, e.path, n), a = L(s.attrs, "location");
    if (a !== void 0) {
      i.push({ name: s.name, location: a, type: o });
      continue;
    }
    const c = fe(o, r);
    if (c.kind !== "identifier")
      continue;
    const u = t.find((f) => f.mangledName === (c.mangledName ?? c.name)), d = r.structs.get(c.mangledName ?? c.name);
    if (u)
      for (let f = 0; f < u.members.length; f++) {
        const h = u.members[f];
        if (en(h.attrs, "builtin"))
          continue;
        const p = L(h.attrs, "location");
        p !== void 0 && i.push({ name: h.name, location: p, type: d?.members[f]?.type ?? J(h.type, u.path, n) });
      }
  }
  return i;
}
function en(e, t) {
  return e.some((n) => n.name === t);
}
function sr(e, t = "<runtime>") {
  const n = As(e, t), r = ds(n);
  if (r.imports.length > 0)
    throw T("VGPU-WGSL-REFLECT-SOURCE-IMPORT", "reflectSource() accepts a single raw WGSL string; use resolveShader() for WGSL import graphs.");
  return Bo([{ path: t, source: e, tokens: n, parsed: r }]);
}
function or() {
  const e = /* @__PURE__ */ new Map();
  return {
    getOrCreate(t, n, r, i) {
      const s = r.map(ft), o = `${t}:${n}:${s.join("|")}`, a = e.get(o);
      if (a)
        return a.bindGroup;
      const c = i();
      return e.set(o, { identities: s, bindGroup: c }), c;
    },
    evictIdentity(t) {
      const n = ft(t);
      for (const [r, i] of e)
        i.identities.includes(n) && e.delete(r);
    },
    clearDraw(t) {
      const n = `${t}:`;
      for (const r of e.keys())
        r.startsWith(n) && e.delete(r);
    },
    dispose() {
      e.clear();
    }
  };
}
function ft(e) {
  return typeof e == "string" || typeof e == "number" ? String(e) : `${e.kind}:${e.id}`;
}
function _e(e, t, n) {
  const r = e[t];
  if (!r)
    throw new g({
      code: "VGPU-REFLECT-ENTRY-METADATA-MISSING",
      message: `Entry point '${e.name}' has no reflected ${t}.`,
      fix: "Pass the reflection from reflectSource()/resolveShader().",
      where: n
    });
  return r;
}
const Be = /* @__PURE__ */ new WeakMap();
function ye(e, t) {
  if (!e.gpu.pushErrorScope || !e.gpu.popErrorScope)
    return;
  e.gpu.pushErrorScope("validation");
  const n = Be.get(e.gpu);
  n ? n.push(t) : Be.set(e.gpu, [t]);
}
function D(e) {
  const t = Be.get(e.gpu);
  if (!t?.length || !e.gpu.popErrorScope)
    return;
  const n = t.pop();
  return t.length || Be.delete(e.gpu), { context: n, error: e.gpu.popErrorScope() };
}
function ar(e) {
  const t = [];
  let n = D(e);
  for (; n; )
    t.push(n), n = D(e);
  return t;
}
function jo(e) {
  const t = D(e);
  t && Et(t);
}
function cr(e) {
  for (const t of ar(e))
    Et(t);
}
function R(e) {
  for (const t of e)
    Et(t);
}
function vt(e) {
  return e.gpu.queue.onSubmittedWorkDone?.() ?? Promise.resolve();
}
function ur(e, t = [], n = {}) {
  return Ho(e, t, n.errorSink ?? Yo);
}
function ze(e, t) {
  return {
    context: e.context,
    error: Ko(e.error, t.error)
  };
}
async function Ko(e, t) {
  const n = await Promise.allSettled([e, t]);
  for (const i of n)
    if (i.status === "fulfilled" && i.value)
      return i.value;
  const r = n.find((i) => i.status === "rejected");
  if (r?.status === "rejected")
    throw r.reason;
  return null;
}
async function Ho(e, t, n) {
  await vt(e);
  for (const r of t)
    try {
      const i = await r.error;
      i && await n(ae(r.context.label, r.context.group, i));
    } catch (i) {
      await n(ae(r.context.label, r.context.group, i));
    }
}
function Et(e) {
  e.error.catch(() => {
  });
}
function Yo(e) {
  console.error(e);
}
function dr(e, t, n, r) {
  try {
    t.end();
  } catch (i) {
    const s = ar(e);
    R(n), R(s), n.length = 0;
    const o = s[0]?.context ?? r;
    throw o ? ae(o.label, o.group, i) : i;
  }
}
let Xo = 1;
const tn = /* @__PURE__ */ new WeakMap();
function Qo(e) {
  return e === null || typeof e != "object" || ArrayBuffer.isView(e) || e instanceof ArrayBuffer || Array.isArray(e) ? !0 : e instanceof j || e instanceof ce ? !1 : !lr(e);
}
function lt(e) {
  return typeof e != "object" || e === null || Array.isArray(e) || ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof j || e instanceof ce ? !1 : !lr(e);
}
function nn(e, t, n) {
  switch (e.bindingLayout?.kind) {
    case "buffer":
      return Zo(e, t, n);
    case "texture":
      return Jo(e, t, n);
    case "sampler":
      return ea(e, t);
    case "storageTexture":
      throw B(e, "storage texture", "Pass a storage-compatible texture.");
    case "externalTexture":
      throw B(e, "external texture", "Pass a compatible GPUExternalTexture.");
    default:
      throw B(e, "reflected resource", "Fix shader reflection bindingLayout.");
  }
}
function Zo(e, t, n) {
  const r = as(t);
  if (r)
    return r[qn](e, n.sourceHint);
  if (t instanceof j)
    return Yt(t, `${n.sourceHint}.set`), na(e, t.options.usage), { resource: { buffer: t.gpu }, identity: t.resourceIdentity, unsubscribe: (i) => t.onDestroy(i) };
  if (ia(t))
    return Yt(t.buffer, `${n.sourceHint}.set`), { resource: { buffer: t.gpu, offset: 0, size: t.size }, identity: t.buffer.resourceIdentity, unsubscribe: (i) => t.buffer.onDestroy(i) };
  if (pr(t))
    return { resource: t, identity: Se(t.buffer) };
  if ($t(t))
    return { resource: { buffer: t }, identity: Se(t) };
  throw B(e, "buffer", `Pass a compatible Buffer/Uniform: ${e.name}.set({ ${e.name}: gpu.device.createBuffer(...) }).`);
}
function Jo(e, t, n) {
  const r = fr(t);
  if (r) {
    const i = r.color;
    rn(e, i, n);
    const s = r.onTexturesRecreated?.bind(r);
    return { resource: i.createView(), identity: i.resourceIdentity, unsubscribe: (o) => r.onDestroy(o), onRecreate: s ? (o) => s(o) : void 0 };
  }
  if (t instanceof ce)
    return ra(e, t.usage), rn(e, t, n), { resource: t.createView(), identity: t.resourceIdentity, unsubscribe: (i) => t.onDestroy(i) };
  if (hr(t))
    return { resource: t.createView(), identity: t.resourceIdentity ?? Se(t) };
  if (typeof t == "object" && t !== null)
    return { resource: t, identity: Se(t) };
  throw B(e, "texture/target", `Pass a Texture or Target: ${e.name}.set({ ${e.name}: scene.color }) or set({ ${e.name}: scene }).`);
}
function ea(e, t) {
  if (ta(t))
    return { resource: t, identity: Se(t) };
  throw B(e, "sampler", `Use the cached sampler: set({ ${e.name}: sampler(gpu) }).`);
}
function ta(e) {
  return typeof e != "object" || e === null || e instanceof j || e instanceof ce ? !1 : !$t(e) && !pr(e) && !hr(e) && !fr(e);
}
function na(e, t) {
  const n = e.bindingLayout?.kind === "buffer" ? e.bindingLayout.buffer.type : void 0;
  if (n === "uniform" && !t.includes("uniform"))
    throw B(e, "uniform buffer", "Create with usage: ['uniform','copy_dst'].");
  if ((n === "storage" || n === "read-only-storage") && !t.includes("storage"))
    throw B(e, "storage buffer", "Create with usage: ['storage','copy_dst'].");
}
function ra(e, t) {
  if (!t.includes("texture_binding") && !t.includes("render_attachment"))
    throw B(e, "sampled texture", "Use texture_binding usage or a sampleable Target.");
}
function rn(e, t, n) {
  if (!(!n.filterableTexture || n.float32Filterable) && (t.format === "r32float" || t.format === "rg32float" || t.format === "rgba32float"))
    throw Ii(n.sourceHint, e, t.format, t.label ?? "texture", n.pairedSampler);
}
function fr(e) {
  if (typeof e != "object" || e === null)
    return;
  const t = e;
  if (!(!t.resourceIdentity || !t.color || typeof t.onDestroy != "function"))
    return t;
}
function lr(e) {
  const t = e;
  return "gpu" in t || "bindGroup" in t || "createView" in t || "resourceIdentity" in t;
}
function Se(e) {
  if (typeof e != "object" || e === null)
    return `value:${String(e)}`;
  let t = tn.get(e);
  return t || (t = { kind: "external", id: Xo++ }, tn.set(e, t)), t;
}
function ia(e) {
  return typeof e == "object" && e !== null && "gpu" in e && "size" in e && "buffer" in e && e.buffer instanceof j;
}
function hr(e) {
  return typeof e == "object" && e !== null && typeof e.createView == "function";
}
function pr(e) {
  return typeof e == "object" && e !== null && "buffer" in e && $t(e.buffer);
}
function $t(e) {
  return typeof e == "object" && e !== null && "size" in e && "usage" in e && typeof e.destroy == "function";
}
function sa(e, t) {
  oa(e);
  const n = new ArrayBuffer(e.size);
  return kt(new DataView(n), e, 0, t), n;
}
function oa(e) {
  if (e.size === void 0)
    throw G("set", `No se puede inferir byteLength para layout runtime-sized '${e.name}'.`);
}
function kt(e, t, n, r) {
  if (t.members)
    return aa(e, t.members, n, r);
  ca(e, t, n, r);
}
function aa(e, t, n, r) {
  const i = r;
  for (const s of t)
    kt(e, s.layout, n + s.offset, i?.[s.name]);
}
function ca(e, t, n, r) {
  switch (t.type.kind) {
    case "scalar":
      return It(e, n, t.type.name, r);
    case "vector":
      return ua(e, n, t.type, r);
    case "matrix":
      return da(e, t, n, r);
    case "array":
      return fa(e, t, n, r);
    default:
      throw G("set", `No hay writer para layout ${t.type.kind}.`);
  }
}
function It(e, t, n, r) {
  n === "f32" ? e.setFloat32(t, Number(r ?? 0), !0) : n === "i32" ? e.setInt32(t, Number(r ?? 0), !0) : n === "u32" || n === "bool" ? e.setUint32(t, n === "bool" ? r ? 1 : 0 : Number(r ?? 0), !0) : e.setUint16(t, la(Number(r ?? 0)), !0);
}
function ua(e, t, n, r) {
  const i = r, s = mr(n.element);
  for (let o = 0; o < n.width; o++)
    It(e, t + o * s, Tt(n.element), i?.[o] ?? 0);
}
function da(e, t, n, r) {
  const i = t.type, s = r, o = mr(i.element), a = t.stride ?? 16;
  for (let c = 0; c < i.columns; c++)
    for (let u = 0; u < i.rows; u++)
      It(e, n + c * a + u * o, Tt(i.element), s?.[c * i.rows + u] ?? 0);
}
function fa(e, t, n, r) {
  const i = r, s = t.stride ?? t.element?.size ?? 0;
  if (!t.element)
    throw G("set", "Array layout sin element layout.");
  for (let o = 0; o < (i?.length ?? 0); o++)
    kt(e, t.element, n + o * s, i[o]);
}
function mr(e) {
  return Tt(e) === "f16" ? 2 : 4;
}
function Tt(e) {
  if (e.kind !== "scalar")
    throw G("set", `Expected scalar, got ${e.kind}`);
  return e.name;
}
function la(e) {
  const t = new Float32Array(1), n = new Uint32Array(t.buffer);
  t[0] = e;
  const r = n[0], i = r >> 16 & 32768, s = r & 8388607, o = r >> 23 & 255;
  if (o === 255)
    return i | (s ? 32256 : 31744);
  const a = o - 127 + 15;
  return a >= 31 ? i | 31744 : a <= 0 ? a < -10 ? i : i | (s | 8388608) >> 1 - a + 13 : i | a << 10 | s >> 13;
}
const sn = /* @__PURE__ */ new WeakMap();
function ha(e, t) {
  const n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
  for (const s of t) {
    const o = s.stage === "vertex" ? 1 : s.stage === "fragment" ? 2 : 4;
    for (const a of _e(s, "bindings", "visibility")) {
      const c = `${a.group}:${a.binding}`;
      n.set(c, (n.get(c) ?? 0) | o);
    }
    for (const a of _e(s, "samplingPairs", "visibility"))
      a.mode === "filtering" && r.add(`${a.texture.group}:${a.texture.binding}`);
  }
  const i = (s) => n.get(`${s.group}:${s.binding}`) ?? 0;
  return Object.defineProperty(i, "filterable", { value: r }), i;
}
function gr(e, t, n = Ft) {
  return e.flatMap((r) => {
    if (r.group !== t)
      return [];
    const i = n(r);
    return i === 0 ? [] : [{ binding: r.binding, visibility: i, ...ga(r, n.filterable?.has(`${r.group}:${r.binding}`) ?? !1) }];
  });
}
function pa(e, t, n, r = Ft) {
  const i = /* @__PURE__ */ new Map(), s = n.bindings.filter((a) => r(a) !== 0).map((a) => a.group), o = Math.max(-1, ...s);
  for (let a = 0; a <= o; a++)
    i.set(a, ma(e, t, n, a, r));
  return i;
}
function ma(e, t, n, r, i = Ft) {
  return br(e, `${t}.group${r}.bgl`, gr(n.bindings, r, i));
}
function br(e, t, n) {
  let r = sn.get(e.gpu);
  r || (r = /* @__PURE__ */ new Map(), sn.set(e.gpu, r));
  const i = JSON.stringify(n), s = r.get(i);
  if (s)
    return s;
  const o = Ei(e.gpu.createBindGroupLayout({ label: t, entries: n }), { entries: n });
  return r.set(i, o), o;
}
function ga(e, t) {
  const n = e.bindingLayout;
  if (!n)
    throw G("bindGroupLayout", `Binding '${e.name}' does not have a reflected bindingLayout.`);
  return t && n.kind === "texture" && n.texture.sampleType === "unfilterable-float" && !n.texture.multisampled ? { texture: { ...n.texture, sampleType: "float" } } : ba(n);
}
function ba(e) {
  switch (e.kind) {
    case "buffer":
      return { buffer: { ...e.buffer } };
    case "sampler":
      return { sampler: { ...e.sampler } };
    case "texture":
      return { texture: { ...e.texture } };
    case "storageTexture":
      return { storageTexture: { ...e.storageTexture } };
    case "externalTexture":
      return { externalTexture: {} };
  }
}
function Ft(e) {
  const t = globalThis.GPUShaderStage, n = t?.VERTEX ?? 1, r = t?.FRAGMENT ?? 2, i = t?.COMPUTE ?? 4;
  return e.kind === "buffer" ? n | r | i : r | i;
}
function wa(e) {
  const t = ya(e.reflection), n = [...e.bindGroupLayouts.keys()].sort((l, m) => l - m), r = /* @__PURE__ */ new Map();
  function i(l) {
    const m = [];
    for (const [S, E] of Object.entries(l))
      m.push(...o(S, E));
    return m;
  }
  function s(l) {
    const m = e.bindGroupLayouts.get(l.info.group);
    return !!m && !!we(m)?.entries.some((S) => S.binding === l.info.binding);
  }
  function o(l, m) {
    const S = t.get(l);
    if (S)
      return a(S, l, m);
    const E = xa(l, t, e.label);
    if (!E)
      throw G(`${e.label}.set`, `Binding '${l}' does not exist in '${e.label}'.`);
    return c(E, l, m);
  }
  function a(l, m, S) {
    F(l.info.group);
    const E = on(l.info, S);
    an(l, m, E);
    const P = De(l.identity);
    return E === "lib" ? u(l, $a(l.libValue, S)) : f(l, S), s(l) ? rt(l, P) : [];
  }
  function c(l, m, S) {
    F(l.info.group);
    const E = on(l.info, S);
    if (an(l, m, E), Sa(l, m, E), E !== "lib")
      throw G(`${e.label}.set`, `Member '${m}' needs a JS value; set resource '${l.info.name}' instead.`);
    const P = De(l.identity);
    return u(l, { ...ka(l.libValue), [m]: S }), s(l) ? rt(l, P) : [];
  }
  function u(l, m) {
    const S = Qe(l);
    l.libValue = m;
    const E = sa(S, m);
    l.buffer || Y(l, S.size), l.bytes = E, l.buffer.write(E, 0);
  }
  function d(l) {
    const m = we(e.bindGroupLayouts.get(l.group))?.entries.find((P) => P.binding === l.binding), S = e.reflection.entryPoints.flatMap((P) => _e(P, "samplingPairs", e.label)).find((P) => P.mode === "filtering" && P.texture.group === l.group && P.texture.binding === l.binding), E = S && e.reflection.bindings.find((P) => P.group === S.sampler.group && P.binding === S.sampler.binding);
    return { sourceHint: e.label, filterableTexture: m?.texture?.sampleType === "float", float32Filterable: e.device.features.has("float32-filterable"), pairedSampler: E };
  }
  function f(l, m) {
    const S = nn(l.info, m, d(l.info));
    l.unsubscribe?.(), l.unsubscribeRecreate?.(), l.resource = S.resource, l.identity = S.identity, l.unsubscribe = S.unsubscribe?.(() => {
      l.identity && e.cache.evictIdentity(l.identity);
    }), l.unsubscribeRecreate = S.onRecreate?.(() => h(l, m));
  }
  function h(l, m) {
    const S = De(l.identity);
    l.identity && e.cache.evictIdentity(l.identity);
    const E = nn(l.info, m, d(l.info));
    if (l.unsubscribe?.(), l.unsubscribeRecreate?.(), l.resource = E.resource, l.identity = E.identity, l.unsubscribe = E.unsubscribe?.(() => {
      l.identity && e.cache.evictIdentity(l.identity);
    }), l.unsubscribeRecreate = E.onRecreate?.(() => h(l, m)), s(l))
      for (const P of rt(l, S))
        e.onIdentityChange?.(P);
  }
  function p(l, m, S) {
    w(l), va(e.label, l, m, S);
    const E = r.has(l) ? `claimed-group:${l}` : void 0;
    return r.set(l, m), E;
  }
  function w(l) {
    const m = e.bindGroupLayouts.get(l);
    if (!m)
      throw G(`${e.label}.layout`, `@group(${l}) does not exist in '${e.label}'.`);
    return m;
  }
  function b() {
    return n.map($);
  }
  function $(l) {
    const m = r.get(l);
    if (m)
      return { group: l, bindGroup: m, offsets: [], claimValidation: I(m, l) };
    const S = new Set(we(w(l))?.entries.map((ne) => ne.binding)), E = e.reflection.bindings.filter((ne) => ne.group === l && S.has(ne.binding)), P = y(E), Ze = v(E), Je = e.cache.getOrCreate(e.drawId, l, Ze, () => e.device.gpu.createBindGroup({
      label: `${e.label}.group${l}`,
      layout: w(l),
      entries: P
    }));
    return { group: l, bindGroup: Je, offsets: [] };
  }
  function I(l, m) {
    return On(l) ? void 0 : { label: e.label, group: m };
  }
  function y(l) {
    return l.map((m) => {
      const S = A(m);
      return { binding: m.binding, resource: S.resource };
    });
  }
  function v(l) {
    return l.map((m) => A(m).identity);
  }
  function A(l) {
    const m = t.get(l.name);
    if (!m?.resource || !m.identity)
      throw Ti(e.label, l);
    return m;
  }
  function F(l) {
    if (r.has(l))
      throw Fi(e.label, l);
  }
  function Y(l, m) {
    l.buffer = e.device.createBuffer({ size: m, usage: ["uniform", "copy_dst"], label: `${e.label}.${l.info.name}` }), l.resource = { buffer: l.buffer.gpu, offset: 0, size: m }, l.identity = l.buffer.resourceIdentity, l.unsubscribe = l.buffer.onDestroy(() => e.cache.evictIdentity(l.buffer.resourceIdentity));
  }
  function Qe(l) {
    if (l.info.kind !== "buffer" || !l.info.layout?.size)
      throw G(`${e.label}.set`, `Binding '${l.info.name}' needs a compatible resource, not JS.`);
    return l.info.layout;
  }
  return {
    get groups() {
      return n;
    },
    set: i,
    claimGroup: p,
    layout: w,
    bindGroups: b,
    bindingState(l) {
      const m = t.get(l);
      if (!(!m?.ownership || !m.resource || !m.identity))
        return { info: m.info, ownership: m.ownership, resource: m.resource, identity: m.identity };
    }
  };
}
function ya(e) {
  return new Map(e.bindings.map((t) => [t.name, { info: t, memberOwnership: /* @__PURE__ */ new Map() }]));
}
function xa(e, t, n) {
  let r;
  for (const i of t.values())
    if (i.info.layout?.members?.some((s) => s.name === e)) {
      if (r)
        throw G(`${n}.set`, `Binding member '${e}' is ambiguous in '${n}'; set the complete binding.`);
      r = i;
    }
  return r;
}
function on(e, t) {
  return e.bindingLayout?.kind === "buffer" && Qo(t) ? "lib" : "user";
}
function an(e, t, n) {
  if (e.ownership && e.ownership !== n)
    throw Nn(t, e.ownership);
  e.ownership ??= n;
}
function Sa(e, t, n) {
  const r = e.memberOwnership.get(t);
  if (r && r !== n)
    throw Nn(t, r);
  e.memberOwnership.set(t, n);
}
function va(e, t, n, r) {
  const i = On(n);
  if (!i)
    return;
  const s = we(r);
  if (!s)
    return;
  const o = Ea(s.entries, i.layout.entries);
  if (o)
    throw Pi(e, t, o);
}
function Ea(e, t) {
  if (e.length !== t.length)
    return `expected ${e.length} bindings and received ${t.length}`;
  const n = cn(e), r = cn(t);
  for (const [i, s] of n) {
    const o = r.get(i);
    if (!o)
      return `missing @binding(${i})`;
    if (un(s) !== un(o))
      return `@binding(${i}) does not match the reflected layout`;
  }
}
function cn(e) {
  return new Map(e.map((t) => [t.binding, t]));
}
function un(e) {
  return JSON.stringify({
    binding: e.binding,
    visibility: e.visibility,
    buffer: e.buffer,
    sampler: e.sampler,
    texture: e.texture,
    storageTexture: e.storageTexture,
    externalTexture: e.externalTexture ? {} : void 0
  });
}
function rt(e, t) {
  const n = De(e.identity);
  return !n || t === n ? [] : [{
    group: e.info.group,
    binding: e.info.binding,
    bindingName: e.info.name,
    bindingKind: e.info.kind,
    previousIdentity: t,
    newIdentity: n
  }];
}
function De(e) {
  return e === void 0 ? void 0 : ft(e);
}
function $a(e, t) {
  return lt(e) && lt(t) ? { ...e, ...t } : t;
}
function ka(e) {
  return lt(e) ? e : {};
}
const Ia = "rgba8unorm", Pt = Object.freeze([0, 0, 0, 1]);
function We(e, t) {
  const n = e, r = Array.isArray(e) ? e : [n?.r, n?.g, n?.b, n?.a];
  if (r.length !== 4 || !r.every((i) => typeof i == "number" && Number.isFinite(i)))
    throw Hi(t);
  return Ct(e);
}
function Ct(e) {
  const t = e;
  return Array.isArray(e) ? [e[0], e[1], e[2], e[3]] : { r: t.r, g: t.g, b: t.b, a: t.a };
}
function Me(e) {
  return e.colors ?? [{ format: e.format ?? Ia }];
}
function wr(e) {
  return e.depth === !0 ? "depth24plus" : e.depth || void 0;
}
function yr(e) {
  const t = e.msaa;
  if (t === !0 || t === 4)
    return 4;
  if (t === void 0 || t === !1)
    return 1;
  const n = _n();
  throw n.code = "VGPU-TARGET-MSAA-INVALID", n.message = `msaa received ${t}; WebGPU 1|4; use true`, n;
}
function Ta(e, t) {
  if (!e?.size)
    throw _n();
  const n = wr(e);
  if (n === "stencil8")
    throw Bi(n);
  if (yr(e) === 4)
    for (const r of Me(e))
      Fa(r.format, t);
}
function Fa(e, t) {
  if (t.isCompatibilityMode && e === "rgba16float")
    throw G("target", "Dawn compatibility mode does not support rgba16float+msaa.", "Use rgba8unorm for MSAA here, or disable msaa.");
}
function Pa(e, t, n, r) {
  const i = {
    view: (t ?? e).createView(),
    resolveTarget: t ? e.createView() : void 0,
    loadOp: r ? "load" : "clear",
    storeOp: t ? "discard" : "store"
  };
  return r || (i.clearValue = xr(n)), i;
}
function Ca(e, t, n, r, i) {
  if (i) {
    const o = { view: e.createView(), depthReadOnly: !0 };
    return ve(e.format) && (o.stencilReadOnly = !0), o;
  }
  const s = { view: e.createView(), depthLoadOp: t ? "load" : "clear", depthStoreOp: e.sampleCount > 1 ? "discard" : "store" };
  return t || (s.depthClearValue = n ?? 1), e.format && ve(e.format) && (s.stencilLoadOp = t ? "load" : "clear", s.stencilStoreOp = e.sampleCount > 1 ? "discard" : "store", t || (s.stencilClearValue = r ?? 0)), s;
}
function ve(e) {
  return !!e && e.includes("stencil");
}
function xr(e) {
  return Array.isArray(e) ? { r: e[0], g: e[1], b: e[2], a: e[3] } : e;
}
function Sr(e, t) {
  return e[0] === t[0] && e[1] === t[1];
}
function Xe(e) {
  return typeof e == "object" && e !== null && typeof e.renderPassDescriptor == "function";
}
let Aa = 1, Ra = 1;
const Ga = /* @__PURE__ */ new WeakMap(), La = /* @__PURE__ */ new WeakMap();
function Ua(e) {
  return Xe(e) ? {
    colors: e.colors.map((t) => t.format),
    depth: e.depth?.format,
    sampleCount: e.sampleCount
  } : typeof e != "object" || e === null ? { colors: [] } : {
    colors: Array.isArray(e.colors) ? [...e.colors] : e.colors ?? [],
    depth: e.depth,
    sampleCount: e.sampleCount ?? 1
  };
}
function vr(e) {
  return `${e.colors.join(",")}:${e.depth ?? "none"}:${e.sampleCount ?? 1}`;
}
function Da(e, t) {
  if (!Array.isArray(e.colors) || e.colors.length === 0)
    throw Fe(t, "colors must be a non-empty array.");
  const n = e.colors.find((i) => typeof i != "string" || i.length === 0);
  if (n !== void 0)
    throw Fe(t, `colors must contain only GPUTextureFormat strings; received ${String(n)}.`);
  if (e.depth !== void 0 && (typeof e.depth != "string" || e.depth.length === 0))
    throw Fe(t, "depth must be a GPUTextureFormat string.");
  const r = e.sampleCount ?? 1;
  if (r !== 1 && r !== 4)
    throw Fe(t, `sampleCount must be 1 or 4; received ${String(r)}.`);
}
function Ma(e) {
  const t = `${hn(Ga, e.module, () => Aa++)}|${hn(La, e.pipelineLayout, () => Ra++)}|${za(e.vertexBufferLayouts ?? [])}|${vr(e.signature)}`, n = e.topology || e.stripIndexFormat ? `${t}|${e.topology ?? "triangle-list"}|${e.stripIndexFormat ?? "none"}` : t, r = e.cullMode || e.frontFace ? `${n}|${e.cullMode ?? "none"}|${e.frontFace ?? "ccw"}` : n, i = e.unclippedDepth ? `${r}|unclipped` : r, s = e.depthKey ? `${i}|${e.depthKey}` : i, o = e.stencilKey ? `${s}|${e.stencilKey}` : s, a = e.multisampleKey ? `${o}|${e.multisampleKey}` : o, c = e.constantsKey ? `${a}|${e.constantsKey}` : a, u = e.entryKey ? `${c}|${e.entryKey}` : c;
  return e.fragmentKey ? `${u}|${e.fragmentKey}` : u;
}
function dn(e, t, n, r, i) {
  if (r === void 0)
    return t.find((o) => o.stage === n);
  if (typeof r != "string")
    throw Le(e, `${n} received ${ht(r)}; expected an entry point name string.`, i);
  const s = t.find((o) => o.name === r);
  if (!s)
    throw Le(e, `"${r}" matches no entry point in the shader; available entry points: ${fn(t)}.`, i);
  if (s.stage !== n)
    throw Le(e, `"${r}" is a @${s.stage} entry point, not @${n}; available entry points: ${fn(t)}.`, i);
  return s;
}
function fn(e) {
  return e.length ? e.map((t) => `"${t.name}" (@${t.stage})`).join(", ") : "none";
}
function Va(e, t, n, r) {
  if (t !== void 0 && (typeof t != "object" || t === null || Array.isArray(t)))
    throw Te(e, `received ${ht(t)}; expected { overrideNameOrId: number | boolean }.`, r);
  const i = new Map(n.map((o) => [ln(o), o])), s = {};
  for (const [o, a] of Object.entries(t ?? {})) {
    if (!i.has(o))
      throw Te(e, `"${o}" matches no override in the shader; available overrides: ${Oa(n)}.`, r);
    if (typeof a == "boolean") {
      s[o] = a ? 1 : 0;
      continue;
    }
    if (typeof a != "number" || !Number.isFinite(a))
      throw Te(e, `"${o}" received ${ht(a)}; use a finite number or a boolean (WebGPU converts the value to the override's WGSL type, and NaN/Infinity fail that conversion).`, r);
    s[o] = a;
  }
  for (const o of n) {
    const a = ln(o);
    if (o.defaultValue === void 0 && !(a in s))
      throw Te(e, `override '${o.name}' has no default value and must be provided; add constants: { "${a}": value }.`, r);
  }
  return Object.keys(s).length === 0 ? {} : { constants: s, constantsKey: Na(s) };
}
function ln(e) {
  return e.id !== void 0 ? String(e.id) : e.name;
}
function Oa(e) {
  return e.length ? e.map((t) => t.id !== void 0 ? `"${t.id}" (@id of ${t.name})` : `"${t.name}"`).join(", ") : "none";
}
function Na(e) {
  return `cn~${Object.entries(e).sort(([t], [n]) => t < n ? -1 : t > n ? 1 : 0).map(([t, n]) => `${t}=${n}`).join("~")}`;
}
function ht(e) {
  if (typeof e == "string")
    return `"${e}"`;
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}
function Er(e) {
  const t = /* @__PURE__ */ new Map();
  return {
    get(n, r) {
      let i = t.get(n);
      return i || (i = e.gpu.createShaderModule({ label: r, code: n }), t.set(n, i)), i;
    },
    dispose() {
      t.clear();
    }
  };
}
function $r(e) {
  const t = /* @__PURE__ */ new Map();
  return {
    get(n) {
      const r = Wa(n);
      let i = t.get(r);
      return i || (i = e.gpu.createPipelineLayout({ bindGroupLayouts: qa(n) }), t.set(r, i)), i;
    },
    dispose() {
      t.clear();
    }
  };
}
function kr(e, t = {}) {
  return new _a(e, t);
}
class _a {
  device;
  #e = /* @__PURE__ */ new Map();
  #t = /* @__PURE__ */ new Set();
  #n;
  #r;
  #s = !1;
  constructor(t, n) {
    this.device = t, this.#n = n.errorSink ?? (() => {
    }), this.#r = n.registerSettledSource?.(() => [...this.#t]);
  }
  getReady(t) {
    return this.#e.get(t)?.pipeline;
  }
  getSync(t, n, r) {
    this.#u(r.where);
    const i = this.#e.get(t);
    if (i?.pipeline)
      return i.pipeline;
    const s = i ?? {};
    i || this.#e.set(t, s);
    const o = this.#i(t, s, n, r);
    if (!o) {
      s.pending || this.#e.delete(t);
      return;
    }
    return s.pipeline = o, s.pending?.resolve(o), s.pending = void 0, o;
  }
  getAsync(t, n, r) {
    this.#u(r.where);
    const i = this.#e.get(t);
    if (i?.pipeline)
      return Promise.resolve(i.pipeline);
    if (i?.pending)
      return i.pending.promise;
    const s = {}, o = Ba();
    s.pending = o, this.#e.set(t, s);
    let a;
    try {
      a = n();
    } catch (c) {
      const u = he(r.where, c, r.signature);
      return o.reject(u), this.#e.delete(t), o.promise;
    }
    return this.#d(a), a.then((c) => {
      this.#e.get(t) !== s || s.pipeline || s.pending !== o || (s.pipeline = c, s.pending = void 0, o.resolve(c));
    }, (c) => {
      this.#e.get(t) !== s || s.pipeline || s.pending !== o || (s.pending = void 0, this.#e.delete(t), o.reject(he(r.where, c, r.signature)));
    }), o.promise;
  }
  dispose() {
    if (this.#s)
      return;
    this.#s = !0;
    const t = jt("gpu.dispose");
    for (const n of this.#e.values())
      n.pending?.reject(t);
    this.#e.clear(), this.#t.clear(), this.#r?.();
  }
  #i(t, n, r, i) {
    const s = this.device.gpu, o = typeof s.pushErrorScope == "function" && typeof s.popErrorScope == "function";
    o && s.pushErrorScope("validation");
    try {
      const a = r();
      return o && this.#o(t, n, i), a;
    } catch (a) {
      o && this.#c();
      const c = he(i.where, a, i.signature);
      this.#n(c);
      return;
    }
  }
  #o(t, n, r) {
    const i = this.device.gpu.popErrorScope().then((s) => {
      if (!s)
        return;
      const o = he(r.where, s, r.signature);
      return this.#e.get(t) === n && this.#e.delete(t), this.#n(o);
    }, (s) => {
      const o = he(r.where, s, r.signature);
      return this.#e.get(t) === n && this.#e.delete(t), this.#n(o);
    });
    this.#d(i);
  }
  #c() {
    const t = this.device.gpu.popErrorScope?.();
    t && t.catch(() => {
    });
  }
  #u(t) {
    if (this.#s)
      throw jt(t);
  }
  #d(t) {
    this.#t.add(t), t.catch(() => {
    }).then(() => this.#t.delete(t), () => this.#t.delete(t));
  }
}
function Ba() {
  let e, t;
  const n = new Promise((r, i) => {
    e = r, t = i;
  });
  return n.catch(() => {
  }), { promise: n, resolve: e, reject: t };
}
function hn(e, t, n) {
  let r = e.get(t);
  return r || (r = n(), e.set(t, r)), r;
}
function za(e) {
  return JSON.stringify(e.map((t) => ({
    arrayStride: t.arrayStride,
    stepMode: t.stepMode ?? "vertex",
    attributes: [...t.attributes].map((n) => ({
      shaderLocation: n.shaderLocation,
      offset: n.offset,
      format: n.format
    }))
  })));
}
function Wa(e) {
  return JSON.stringify([...e.entries()].map(([t, n]) => ({ group: t, entries: Ka(n) })));
}
function qa(e) {
  const t = Math.max(-1, ...e.keys()), n = [];
  for (let r = 0; r <= t; r++)
    n.push(ja(e, r));
  return n;
}
function ja(e, t) {
  const n = e.get(t);
  if (!n)
    throw _i(t);
  return n;
}
function Ka(e) {
  return (we(e)?.entries ?? []).map((t) => ({
    binding: t.binding,
    visibility: t.visibility,
    buffer: t.buffer ? { ...t.buffer } : void 0,
    sampler: t.sampler ? { ...t.sampler } : void 0,
    texture: t.texture ? { ...t.texture } : void 0,
    storageTexture: t.storageTexture ? { ...t.storageTexture } : void 0,
    externalTexture: t.externalTexture ? { ...t.externalTexture } : void 0
  }));
}
const Ha = $e("frame-state");
function At(e) {
  return e.service(Ha, Ya);
}
function Ya() {
  const e = /* @__PURE__ */ new Set();
  let t = pn(), n = !1, r = !1;
  const i = {
    time: 0,
    deltaTime: 0,
    frameCount: 0,
    advanceBy(s) {
      i.deltaTime = s, i.time += s, r = !0;
    },
    tick() {
      if (n)
        throw zn();
      n = !0;
      try {
        const s = pn();
        r ? r = !1 : (i.deltaTime = Math.max(0, (s - t) / 1e3), i.time += i.deltaTime), t = s, i.frameCount += 1;
        for (const o of [...e])
          o();
      } finally {
        n = !1;
      }
    },
    onAdvance(s) {
      return e.add(s), () => {
        e.delete(s);
      };
    }
  };
  return i;
}
function pn() {
  return globalThis.performance?.now?.() ?? Date.now();
}
function Xa(e, t, n = {}) {
  const r = ue(e, "surface"), i = Za(r), s = i.get(t);
  if (s && !s.disposed)
    throw Wi(s.label);
  const o = new Tr(r.device, t, n, (u) => {
    i.get(u.canvas) === u && i.delete(u.canvas), a(), c();
  }), a = At(r).onAdvance(() => o.applyAutoResize()), c = r.own("resource", () => o.dispose());
  return i.set(t, o), o;
}
const Qa = $e("surfaces");
function Za(e) {
  return e.service(Qa, () => /* @__PURE__ */ new Map());
}
let be = 0, Rt = 0;
function Ja() {
  return be > 0;
}
function ec() {
  return Rt > 0;
}
function tc() {
  Rt += 1;
}
function nc() {
  Rt -= 1;
}
function Ir(e) {
  return e instanceof Tr;
}
class Tr {
  device;
  canvas;
  options;
  unregister;
  resourceIdentity = Ke("render-target");
  label;
  context;
  autoResize;
  layoutBacked;
  format;
  #e = new He();
  #t = /* @__PURE__ */ new Set();
  #n = /* @__PURE__ */ new Set();
  #r;
  #s;
  #i = !1;
  #o = !1;
  constructor(t, n, r, i) {
    this.device = t, this.canvas = n, this.options = r, this.unregister = i, this.label = r.label, this.#s = r.clearColor === void 0 ? Pt : We(r.clearColor, "surface.clearColor");
    const s = n.getContext("webgpu");
    if (!s)
      throw zi();
    if (this.context = s, this.layoutBacked = rc(n), r.autoResize === !0 && !this.layoutBacked)
      throw ji();
    this.autoResize = r.autoResize ?? (r.size ? !1 : this.layoutBacked), this.#r = gn(r.dpr), this.format = r.format ?? sc();
    const o = ic(n, r, this.layoutBacked, this.#r);
    (r.size || this.layoutBacked) && mn(n, o), s.configure({
      device: t.gpu,
      format: this.format,
      alphaMode: r.alphaMode ?? "premultiplied",
      colorSpace: r.colorSpace ?? "srgb",
      usage: oc()
    });
  }
  get gpu() {
    return this.context;
  }
  get size() {
    return this.#a(), Ve(this.canvas);
  }
  get texelSize() {
    const t = this.size;
    return [1 / t[0], 1 / t[1]];
  }
  get color() {
    return this.#a(), new ce(this.device, this.context.getCurrentTexture(), {
      size: this.size,
      format: this.format,
      usage: ["render_attachment", "texture_binding", "copy_src"],
      label: this.options.label ? `${this.options.label}.color` : "surface.color"
    }, "external");
  }
  get colors() {
    return [this.color];
  }
  get depth() {
    this.#a();
  }
  get sampleCount() {
    return this.#a(), 1;
  }
  get dpr() {
    return this.#r;
  }
  /** Default clear color of this surface; passes that clear without naming a color use it. */
  get clearColor() {
    return Ct(this.#s);
  }
  set clearColor(t) {
    this.#s = We(t, "surface.clearColor");
  }
  get disposed() {
    return this.#i;
  }
  resize(t) {
    if (this.#a(), this.#o)
      throw Ki(this.options.label);
    this.#c(qe(t), this.#r, !0);
  }
  applyAutoResize() {
    if (this.#i || !this.autoResize || !this.layoutBacked)
      return;
    const t = gn(this.options.dpr), n = Fr(this.canvas, t);
    this.#c(n, t, !0);
  }
  onResize(t) {
    this.#a(), this.#t.add(t), this.#o = !0, be += 1;
    try {
      t(this.#f());
    } finally {
      be -= 1, this.#o = !1;
    }
    return () => {
      this.#t.delete(t);
    };
  }
  async read() {
    return this.#a(), this.color.read();
  }
  async readFloats() {
    return this.#a(), this.color.readFloats();
  }
  onDestroy(t) {
    return this.#a(), this.#e.onDestroy(this, t);
  }
  onTexturesRecreated(t) {
    return this.#a(), this.#n.add(t), () => {
      this.#n.delete(t);
    };
  }
  renderPassDescriptor(t = {}) {
    const { clear: n = [0, 0, 0, 1], preserve: r } = t;
    this.#a();
    const i = { view: this.context.getCurrentTexture().createView(), loadOp: r ? "load" : "clear", storeOp: "store" };
    return r || (i.clearValue = xr(n)), { colorAttachments: [i] };
  }
  dispose() {
    if (!this.#i) {
      this.#i = !0;
      try {
        this.context.unconfigure?.();
      } catch {
      }
      this.unregister(this), this.#t.clear(), this.#n.clear(), this.#e.emit(this);
    }
  }
  #c(t, n, r) {
    const i = !Sr(Ve(this.canvas), t);
    this.#r = n, i && (mn(this.canvas, t), this.#u(), r && this.#d());
  }
  #u() {
    for (const t of [...this.#n])
      t();
  }
  #d() {
    this.#o = !0, be += 1;
    try {
      const t = this.#f();
      for (const n of [...this.#t])
        n(t);
    } finally {
      be -= 1, this.#o = !1;
    }
  }
  #f() {
    const t = Ve(this.canvas);
    return { width: t[0], height: t[1], dpr: this.#r, surface: this };
  }
  #a() {
    if (this.#i)
      throw qi(this.options.label);
  }
}
function rc(e) {
  return typeof e.clientWidth == "number";
}
function ic(e, t, n, r) {
  return t.size ? qe(t.size) : n ? Fr(e, r) : qe(Ve(e));
}
function Fr(e, t) {
  const n = e;
  return qe([Math.round(n.clientWidth * t), Math.round(n.clientHeight * t)]);
}
function Ve(e) {
  const t = e;
  return [t.width, t.height];
}
function mn(e, t) {
  const n = e;
  n.width = t[0], n.height = t[1];
}
function qe(e) {
  return [Math.max(1, Math.floor(e[0])), Math.max(1, Math.floor(e[1]))];
}
function gn(e) {
  const t = globalThis.devicePixelRatio ?? 1;
  return Array.isArray(e) ? Math.min(e[1], Math.max(e[0], t)) : typeof e == "number" ? e : t;
}
function sc() {
  return globalThis.navigator?.gpu?.getPreferredCanvasFormat?.() ?? "bgra8unorm";
}
function oc() {
  const e = globalThis.GPUTextureUsage;
  return e ? e.RENDER_ATTACHMENT | e.TEXTURE_BINDING | e.COPY_SRC : void 0;
}
const ac = {
  drawIndirect: { bytes: 16, args: "4 u32 values: vertexCount, instanceCount, firstVertex, firstInstance" },
  drawIndexedIndirect: { bytes: 20, args: "5 32-bit values: indexCount, instanceCount, firstIndex, baseVertex (signed), firstInstance" },
  dispatchWorkgroupsIndirect: { bytes: 12, args: "3 u32 values: workgroupCountX, workgroupCountY, workgroupCountZ" }
};
function cc(e, t, n, r) {
  const i = typeof n == "object" && n !== null ? n.buffer : void 0, s = bn(n) ? n : bn(i) ? i : void 0;
  if (!s)
    throw re(e, `received ${wn(n)}; expected a StorageBuffer or { buffer, offset? }.`, t);
  const o = s === n ? 0 : n.offset ?? 0;
  if (typeof o != "number" || !Number.isInteger(o) || o < 0)
    throw re(e, `offset must be an integer >= 0; received ${wn(o)}.`, t);
  if (o % 4 !== 0)
    throw re(e, `offset must be a multiple of 4 (WebGPU requires "indirectOffset is a multiple of 4"); received ${o}.`, t);
  if (!s.buffer.options.usage.includes("indirect"))
    throw re(e, `the buffer lacks the "indirect" usage (WebGPU requires "indirectBuffer.usage contains INDIRECT"); create it with storage(gpu, ${s.size}, { indirect: true }).`, t);
  const { bytes: a, args: c } = ac[r];
  if (o + a > s.size)
    throw re(e, `${r} reads ${a} bytes (${c}) at offset ${o}, but offset + ${a} = ${o + a} exceeds the buffer size ${s.size}.`, t);
  return { buffer: s.gpu, offset: o };
}
function bn(e) {
  return typeof e == "object" && e !== null && "gpu" in e && "size" in e && e.buffer instanceof j;
}
function wn(e) {
  if (typeof e == "string")
    return `"${e}"`;
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}
const je = /* @__PURE__ */ Symbol("vgpu.frame.drawable");
function uc(e) {
  return e?.[je];
}
const dc = /* @__PURE__ */ Symbol("vgpu.frame.bundle");
function fc(e) {
  return e?.[dc];
}
const Pr = /* @__PURE__ */ Symbol("vgpu.frame.passAttachment");
function lc(e) {
  return typeof e?.[Pr] == "function" ? e : void 0;
}
let yn = 1;
function hc(e) {
  const t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new WeakMap();
  return {
    sampler(r = {}) {
      const i = pt(r);
      let s = t.get(i);
      return s || (s = e.gpu.createSampler(r), t.set(i, s), n.set(s, { kind: "sampler", id: yn++ })), s;
    },
    identity(r) {
      let i = n.get(r);
      return i || (i = { kind: "sampler", id: yn++ }, n.set(r, i)), i;
    }
  };
}
function pt(e) {
  if (e === null || typeof e != "object")
    return JSON.stringify(e);
  if (Array.isArray(e))
    return `[${e.map(pt).join(",")}]`;
  const t = e;
  return `{${Object.keys(t).sort().map((n) => `${JSON.stringify(n)}:${pt(t[n])}`).join(",")}}`;
}
const pc = $e("render-service");
function mc(e) {
  return e.service(pc, gc);
}
function gc(e) {
  const t = e.device, n = or(), r = kr(t, {
    errorSink: (a) => e.reportError(a),
    registerSettledSource: (a) => e.registerSettledSource(a)
  }), i = Er(t), s = $r(t), o = hc(t);
  return e.own("service", () => {
    r.dispose(), i.dispose(), s.dispose(), n.dispose();
  }), { binds: n, pipelines: r, shaderModules: i, pipelineLayouts: s, sampler: (a) => o.sampler(a) };
}
function bc(e) {
  if (typeof e == "string")
    return e;
  if (!wc(e) || !("version" in e) || e.version !== 1)
    throw Pe(e);
  const n = e.wgsl;
  if (typeof n != "string")
    throw Pe(e);
  return n;
}
function wc(e) {
  return typeof e == "object" && e !== null;
}
let yc = 1;
const Cr = /* @__PURE__ */ new WeakMap();
class xc {
  source;
  label;
  #e = /* @__PURE__ */ new Map();
  constructor(t, n, r, i = or(), s, o = kr(t), a = Er(t), c = $r(t), u, d) {
    this.source = n, C(t, "Draw.constructor"), this.label = r.label ?? "draw";
    const f = yc++, h = sr(n, `${this.label}.wgsl`), p = Pc(this.label, r.entry), w = dn(this.label, h.entryPoints, "vertex", p.vertex, "draw"), b = dn(this.label, h.entryPoints, "fragment", p.fragment, "draw"), $ = Cc(h, w, b), I = [w, b].filter((le) => !!le), y = ha(h.bindings, I);
    Sc(t, this.label, h.bindings, I, y);
    const v = r.geometry, A = w ? _e(w, "inputs", this.label) : [], F = v && ct in v ? v[ct](A, `${this.label}.geometry`) : v?.vertexBufferLayouts, Y = new Map(pa(t, this.label, h, y)), Qe = c.get(Y), l = a.get(n, `${this.label}.shader`), m = Kc(), S = $c(this.label, r), E = Ic(this.label, r, S), P = Ac(t, this.label, r), Ze = Uc(t, this.label, r), Je = Oc(this.label, r), ne = _c(this.label, r), Nr = Va(this.label, r.constants, h.overrides, "draw"), _r = wa({
      device: t,
      label: this.label,
      drawId: f,
      reflection: h,
      bindGroupLayouts: Y,
      cache: i,
      onIdentityChange: (le) => m.markStale({ kind: "binding-identity", drawLabel: this.label, ...le })
    });
    Cr.set(this, { id: f, device: t, opts: r, vertexBufferLayouts: F, cache: i, defaultTarget: s, reflection: h, visibility: y, vertexEntry: w?.name ?? "vs_main", fragmentEntry: b?.name ?? "fs_main", entryKey: $, setCore: _r, bindGroupLayouts: Y, pipelineLayout: Qe, shaderModule: l, pipelineStore: o, pipelineLayouts: c, errorSink: u, trackSettled: d, resolvedPipelineKeys: /* @__PURE__ */ new Set(), recordedIn: m, ...S, ...E, ...P, ...Ze, ...Je, ...ne, ...Nr }), r.set && this.set(r.set);
    for (const le of r.targets ?? [])
      this.compileSync(le);
  }
  get gpu() {
    const t = x(this);
    for (const n of t.resolvedPipelineKeys) {
      const r = t.pipelineStore.getReady(n);
      if (r)
        return r;
    }
  }
  get targets() {
    return x(this).opts.targets;
  }
  /**
   * Frame drawable protocol: a `Frame` encodes through this instead of importing draw.ts, so a
   * program that never draws never pulls this module. The instance is its own protocol object —
   * `encode`, `label` and the depth/stencil metadata below are exactly what a pass needs.
   */
  get [je]() {
    return this;
  }
  /** @internal Frame drawable protocol; see {@link drawWritesDepth}. */
  writesDepth() {
    return Wc(this);
  }
  /** @internal Frame drawable protocol; see {@link drawStencilWritingOps}. */
  stencilWritingOps() {
    return qc(this);
  }
  set(t) {
    const n = x(this);
    C(n.device, `${this.label}.set`);
    for (const r of n.setCore.set(t))
      n.recordedIn.markStale({ kind: "binding-identity", drawLabel: this.label, ...r });
    return this;
  }
  group(t, n) {
    const r = x(this);
    C(r.device, `${this.label}.group`);
    const i = this.#e.get(t) ?? this.layout(t), s = r.setCore.claimGroup(t, n, i);
    return r.recordedIn.markStale({ kind: "group-claim", drawLabel: this.label, group: t, previousIdentity: s, newIdentity: `claimed-group:${t}` }), this;
  }
  layout(t, n = {}) {
    return C(x(this).device, `${this.label}.layout`), n.dynamicOffsets ? this.#t(t) : x(this).setCore.layout(t);
  }
  #t(t) {
    const n = x(this);
    n.setCore.layout(t);
    const r = this.#e.get(t);
    if (r)
      return r;
    const i = Yc(this, t), s = br(n.device, `${this.label}.group${t}.dynamic.bgl`, i);
    return this.#e.set(t, s), n.bindGroupLayouts.set(t, s), n.pipelineLayout = n.pipelineLayouts.get(n.bindGroupLayouts), s;
  }
  /**
   * Encodes and submits this draw as a one-shot render pass.
   *
   * Raw claimed-bind-group validation failures are delivered asynchronously via
   * `gpu.onError` as `VGPU-R4-GROUP-VALIDATION`.
   */
  draw(t = {}) {
    C(x(this).device, `${this.label}.draw`);
    const n = Xe(t) ? { target: t } : t, r = x(this), i = n.target ?? r.defaultTarget;
    if (!i)
      throw at(`${this.label}.draw`);
    Gn(i, `${this.label}.draw`);
    const s = r.device.gpu.createCommandEncoder(), o = s.beginRenderPass(i.renderPassDescriptor()), a = [];
    try {
      this.encode(o, i, n, (f) => a.push(f));
    } catch (f) {
      R(a), cr(r.device);
      try {
        o.end();
      } catch {
      }
      throw f;
    }
    dr(r.device, o, a, a[0]?.context);
    let c;
    const u = a[0]?.context;
    u && ye(r.device, u);
    try {
      c = s.finish();
    } catch (f) {
      const h = u ? D(r.device) : void 0;
      R(a), h && R([h]);
      const p = h?.context ?? u;
      if (p) {
        Rn(r, p.label, p.group, f);
        return;
      }
      throw f;
    }
    if (u) {
      const f = D(r.device);
      f && (a[0] = a[0] ? ze(f, a[0]) : f);
    }
    const d = a[0]?.context;
    d && ye(r.device, d);
    try {
      r.device.gpu.queue.submit([c]);
    } catch (f) {
      const h = d ? D(r.device) : void 0;
      R(a), h && R([h]);
      const p = h?.context ?? d;
      if (p) {
        Rn(r, p.label, p.group, f);
        return;
      }
      throw f;
    }
    if (d) {
      const f = D(r.device);
      f && (a[0] = a[0] ? ze(f, a[0]) : f);
    }
    if (a.length) {
      const f = ur(r.device, a, { errorSink: r.errorSink });
      r.trackSettled?.(f);
    }
  }
  encode(t, n, r = {}, i) {
    C(x(this).device, `${this.label}.encode`);
    const s = this.pipelineFor(n, !0);
    if (!s)
      return;
    t.setPipeline(s);
    const o = x(this);
    o.blendConstant && t.setBlendConstant(o.blendConstant), o.stencilRef !== void 0 && t.setStencilReference(o.stencilRef);
    for (const a of o.setCore.bindGroups())
      this.#n(t, a, r, i);
    this.#o(t, r);
  }
  #n(t, n, r, i) {
    const s = Hc(r.offsets, n.group, n.offsets);
    if (!n.claimValidation || !i) {
      t.setBindGroup(n.group, n.bindGroup, s);
      return;
    }
    ye(x(this).device, n.claimValidation);
    try {
      t.setBindGroup(n.group, n.bindGroup, s);
    } catch (a) {
      throw jo(x(this).device), ae(n.claimValidation.label, n.claimValidation.group, a);
    }
    const o = D(x(this).device);
    o && i(o);
  }
  compile(t) {
    C(x(this).device, `${this.label}.compile`);
    const { key: n, signature: r, signatureKey: i } = this.#r(t, `${this.label}.compile`);
    return x(this).pipelineStore.getAsync(n, () => this.#d(r), { where: `${this.label}.compile`, signature: i }).then(() => (C(x(this).device, `${this.label}.compile`), x(this).resolvedPipelineKeys.add(n), this));
  }
  compileSync(t) {
    C(x(this).device, `${this.label}.compileSync`);
    const { key: n, signature: r, signatureKey: i } = this.#r(t, `${this.label}.compileSync`);
    return x(this).pipelineStore.getSync(n, () => this.#u(r), { where: `${this.label}.compileSync`, signature: i }) && x(this).resolvedPipelineKeys.add(n), this;
  }
  pipelineFor(t, n = !1) {
    C(x(this).device, `${this.label}.pipelineFor`);
    const { key: r, signature: i, signatureKey: s } = this.#r(t, `${this.label}.pipelineFor`, n), o = x(this).pipelineStore.getSync(r, () => this.#u(i), { where: `${this.label}.pipelineFor`, signature: s });
    return o && x(this).resolvedPipelineKeys.add(r), o;
  }
  pipelineForAsync(t) {
    C(x(this).device, `${this.label}.pipelineForAsync`);
    const { key: n, signature: r, signatureKey: i } = this.#r(t, `${this.label}.pipelineForAsync`);
    return x(this).pipelineStore.getAsync(n, () => this.#d(r), { where: `${this.label}.pipelineForAsync`, signature: i }).then((o) => (C(x(this).device, `${this.label}.pipelineForAsync`), x(this).resolvedPipelineKeys.add(n), o));
  }
  #r(t, n, r = !1) {
    const i = this.#s(t, n, r), s = vr(i);
    return { signature: i, signatureKey: s, key: this.#i(i) };
  }
  #s(t, n, r = !1) {
    const i = x(this), s = t ?? i.defaultTarget;
    if (!s)
      throw at(n);
    r || Gn(s, n);
    const o = Ua(s);
    if (Da(o, n), i.colorStates && i.colorStates.length !== o.colors.length)
      throw ot(this.label, `expected one entry per color attachment; colors has ${i.colorStates.length}, but the target signature has ${o.colors.length}.`, n);
    if (i.multisampleState?.alphaToCoverageEnabled && (o.sampleCount ?? 1) <= 1)
      throw Ge(this.label, `alphaToCoverage requires a multisampled target, but the target signature has sampleCount ${o.sampleCount ?? 1}; create the target with msaa: true.`, n);
    if ((i.stencilState || i.stencilRef !== void 0) && !ve(o.depth))
      throw se(this.label, `stencil requires a depth format with a stencil aspect, but the target signature has ${o.depth ? `"${o.depth}"` : "no depth"}; create the target with depth: "depth24plus-stencil8".`, n);
    return o;
  }
  #i(t) {
    const n = x(this), r = n.opts.geometry;
    return Ma({ module: n.shaderModule, pipelineLayout: n.pipelineLayout, vertexBufferLayouts: n.vertexBufferLayouts, signature: t, fragmentKey: n.fragmentKey, topology: r?.topology, stripIndexFormat: Ar(r), cullMode: n.cullMode, frontFace: n.frontFace, unclippedDepth: n.unclippedDepth, depthKey: n.depthKey, stencilKey: n.stencilKey, multisampleKey: n.multisampleKey, constantsKey: n.constantsKey, entryKey: n.entryKey });
  }
  #o(t, n = {}) {
    const r = x(this).opts.geometry;
    if (r?.vertexBuffers && r.vertexBuffers.forEach((s, o) => t.setVertexBuffer(o, s)), n.indirect !== void 0)
      return this.#c(t, r, n);
    const i = Ec(this.label, r, x(this).opts, n);
    if (!r?.indexBuffer)
      return t.draw(i.vertexCount, i.instanceCount, i.firstVertex, i.firstInstance);
    t.setIndexBuffer(r.indexBuffer, r.indexFormat ?? "uint32"), t.drawIndexed(i.indexCount, i.instanceCount, i.firstIndex, i.baseVertex, i.firstInstance);
  }
  /**
   * The GPU reads the draw arguments from the buffer, so per-call counts alongside indirect are dead options and throw.
   * A non-zero firstInstance in the buffered arguments cannot be validated on the CPU; per WebGPU, it "must be 0,
   * unless the 'indirect-first-instance' feature is enabled", otherwise the indirect call "will be treated as a no-op".
   */
  #c(t, n, r) {
    const i = `${this.label}.draw`, s = vc.find((u) => r[u] !== void 0);
    if (s !== void 0)
      throw re(this.label, `indirect cannot be combined with ${s} in the same call; the GPU reads the draw arguments from the buffer, so the CPU-side value would be ignored.`, i);
    const o = !!n?.indexBuffer, { buffer: a, offset: c } = cc(this.label, i, r.indirect, o ? "drawIndexedIndirect" : "drawIndirect");
    if (!o)
      return t.drawIndirect(a, c);
    t.setIndexBuffer(n.indexBuffer, n.indexFormat ?? "uint32"), t.drawIndexedIndirect(a, c);
  }
  #u(t) {
    const n = x(this);
    return n.device.gpu.createRenderPipeline({
      label: `${this.label}.pipeline`,
      layout: n.pipelineLayout,
      vertex: { module: n.shaderModule, entryPoint: n.vertexEntry, buffers: [...n.vertexBufferLayouts ?? []], ...n.constants ? { constants: n.constants } : {} },
      fragment: { module: n.shaderModule, entryPoint: n.fragmentEntry, targets: xn(t, n), ...n.constants ? { constants: n.constants } : {} },
      primitive: Sn(n.opts.geometry, n.cullMode, n.frontFace, n.unclippedDepth),
      depthStencil: Tn(t, n),
      multisample: Cn(t, n)
    });
  }
  #d(t) {
    const n = x(this);
    return n.device.gpu.createRenderPipelineAsync({
      label: `${this.label}.pipeline`,
      layout: n.pipelineLayout,
      vertex: { module: n.shaderModule, entryPoint: n.vertexEntry, buffers: [...n.vertexBufferLayouts ?? []], ...n.constants ? { constants: n.constants } : {} },
      fragment: { module: n.shaderModule, entryPoint: n.fragmentEntry, targets: xn(t, n), ...n.constants ? { constants: n.constants } : {} },
      primitive: Sn(n.opts.geometry, n.cullMode, n.frontFace, n.unclippedDepth),
      depthStencil: Tn(t, n),
      multisample: Cn(t, n)
    });
  }
}
function Sc(e, t, n, r, i) {
  const s = e.limits;
  for (const [o, a, c] of [["vertex", 1, "maxStorageBuffersInVertexStage"], ["fragment", 2, "maxStorageBuffersInFragmentStage"]]) {
    const u = r.find((h) => h.stage === o);
    if (!u)
      continue;
    const d = n.filter((h) => h.bindingLayout?.kind === "buffer" && h.bindingLayout.buffer.type !== "uniform" && i(h) & a), f = s[c] ?? s.maxStorageBuffersPerShaderStage;
    if (f !== void 0 && d.length > f)
      throw ki(t, o, u.name, d.length, f, d);
  }
}
const vc = ["vertices", "indices", "instances", "firstVertex", "firstIndex", "baseVertex", "firstInstance"];
function xn(e, t) {
  return e.colors.map((n, r) => {
    const i = t.colorStates?.[r], s = i?.blendState ?? t.blendState, o = i?.writeMask ?? t.writeMask, a = { format: n };
    return s && (a.blend = s), o !== void 0 && (a.writeMask = o), a;
  });
}
function Ec(e, t, n, r) {
  W(e, "DrawOptions.instances", n.instances), W(e, "DrawOptions.vertices", n.vertices), W(e, "DrawOptions.firstInstance", n.firstInstance), W(e, "DrawCallOptions.instances", r.instances), z(e, "DrawCallOptions.vertices", r.vertices), z(e, "DrawCallOptions.indices", r.indices), z(e, "DrawCallOptions.firstVertex", r.firstVertex), z(e, "DrawCallOptions.firstIndex", r.firstIndex), z(e, "DrawCallOptions.baseVertex", r.baseVertex), W(e, "DrawCallOptions.firstInstance", r.firstInstance), W(e, "GeometryLike.vertexCount", t?.vertexCount), W(e, "GeometryLike.indexCount", t?.indexCount), W(e, "GeometryLike.instanceCount", t?.instanceCount), z(e, "GeometryLike.firstVertex", t?.firstVertex), z(e, "GeometryLike.firstIndex", t?.firstIndex), z(e, "GeometryLike.baseVertex", t?.baseVertex);
  const i = !!t?.indexBuffer, o = t?.geometry ?? (t && ct in t ? t : void 0), a = r.firstVertex ?? t?.firstVertex ?? 0, c = r.vertices ?? t?.vertexCount ?? n.vertices ?? 3, u = r.firstIndex ?? t?.firstIndex ?? 0, d = r.indices ?? t?.indexCount ?? 0, f = r.baseVertex ?? t?.baseVertex ?? 0;
  if (i)
    vn(e, "index", u, d, o?.indexCount);
  else if (r.indices !== void 0 || r.firstIndex !== void 0 || r.baseVertex !== void 0)
    throw gt(`${e}.draw`, "Index range needs an indexed geometry.");
  return i || vn(e, "vertex", a, c, o?.vertexCount), {
    instanceCount: r.instances ?? n.instances ?? t?.instanceCount ?? 1,
    firstInstance: r.firstInstance ?? n.firstInstance ?? 0,
    vertexCount: c,
    firstVertex: a,
    indexCount: d,
    firstIndex: u,
    baseVertex: f
  };
}
function Ar(e) {
  const t = e?.topology ?? "triangle-list";
  return e?.stripIndexFormat ?? (t.endsWith("strip") ? e?.indexFormat : void 0);
}
function Sn(e, t, n, r) {
  const i = e?.topology ?? "triangle-list", s = Ar(e), o = s ? { topology: i, stripIndexFormat: s } : { topology: i };
  return t !== void 0 && (o.cullMode = t), n !== void 0 && (o.frontFace = n), r && (o.unclippedDepth = !0), o;
}
function vn(e, t, n, r, i) {
  if (!(i === void 0 || n + r <= i))
    throw gt(`${e}.draw`, `${t} range [${n}, ${n + r}) exceeds parent geometry ${t} count ${i}.`);
}
function z(e, t, n) {
  if (!(n === void 0 || Number.isInteger(n) && n >= 0))
    throw gt(`${e}.draw`, `${t} must be an integer >= 0; received ${String(n)}.`);
}
function W(e, t, n) {
  if (n !== void 0 && !(Number.isInteger(n) && n >= 0))
    throw new g({
      code: "VGPU-R1-DRAW-COUNT",
      message: `${t} of '${e}' must be an integer >= 0; received ${String(n)}. Use 0 only when you want to issue a valid draw with no vertices/instances.`,
      where: `${e}.draw`
    });
}
function $c(e, t) {
  const n = t.blend === void 0 ? void 0 : Rr(e, t.blend), r = t.writeMask === void 0 ? void 0 : Ur(e, t.writeMask), i = t.colors === void 0 ? void 0 : kc(e, t.colors), s = i ? `${An(n, r)}@${i.map(zc).join("@")}` : n || r !== void 0 ? An(n, r) : void 0;
  return { blendState: n, writeMask: r, colorStates: i, fragmentKey: s };
}
function kc(e, t) {
  if (!Array.isArray(t))
    throw ot(e, `colors must be an array; received ${k(t)}.`);
  return t.map((n, r) => {
    if (n == null)
      return null;
    if (typeof n != "object" || Array.isArray(n))
      throw ot(e, `colors[${r}] must be null or { blend?, writeMask? }; received ${k(n)}.`);
    const i = n.blend === void 0 ? void 0 : Rr(`${e}.colors[${r}]`, n.blend), s = n.writeMask === void 0 ? void 0 : Ur(`${e}.colors[${r}]`, n.writeMask);
    return !i && s === void 0 ? null : { blendState: i, writeMask: s };
  });
}
function Rr(e, t) {
  if (t === "alpha")
    return Re({ src: "src-alpha", dst: "one-minus-src-alpha" }, { src: "one", dst: "one-minus-src-alpha" });
  if (t === "premultiplied")
    return Re({ src: "one", dst: "one-minus-src-alpha" }, { src: "one", dst: "one-minus-src-alpha" });
  if (t === "additive")
    return Re({ src: "one", dst: "one" }, { src: "one", dst: "one" });
  if (typeof t != "object" || t === null || !En(t.color))
    throw Nt(e, t);
  const n = t.color, r = t.alpha;
  if (r !== void 0 && !En(r))
    throw Nt(e, t);
  return Re(n, r ?? n);
}
function En(e) {
  return typeof e == "object" && e !== null && typeof e.src == "string" && typeof e.dst == "string";
}
function Re(e, t) {
  return { color: $n(e), alpha: $n(t) };
}
function $n(e) {
  return { srcFactor: e.src, dstFactor: e.dst, operation: e.op ?? "add" };
}
function Ic(e, t, n) {
  if (t.blendConstant === void 0)
    return {};
  const r = t.blendConstant;
  if (!Array.isArray(r) || r.length !== 4 || r.some((i) => typeof i != "number" || !Number.isFinite(i)))
    throw _t(e, `received ${k(r)}; expected [r, g, b, a] finite numbers.`);
  if (!Tc(n).some((i) => i && Fc(i)))
    throw _t(e, `no color target's effective blend uses a "constant"/"one-minus-constant" factor (colors[i].blend replaces the top-level blend for that target), so blendConstant would have no effect.`);
  return { blendConstant: { r: r[0], g: r[1], b: r[2], a: r[3] } };
}
function Tc(e) {
  return e.colorStates ? e.colorStates.map((t) => t?.blendState ?? e.blendState) : [e.blendState];
}
function Fc(e) {
  return [e.color.srcFactor, e.color.dstFactor, e.alpha.srcFactor, e.alpha.dstFactor].some((t) => t === "constant" || t === "one-minus-constant");
}
function Pc(e, t) {
  if (t === void 0)
    return {};
  if (typeof t != "object" || t === null || Array.isArray(t))
    throw Le(e, `received ${k(t)}; expected { vertex?, fragment? } entry point names.`);
  return t;
}
function Cc(e, t, n) {
  const r = e.entryPoints.find((s) => s.stage === "vertex"), i = e.entryPoints.find((s) => s.stage === "fragment");
  if (!(t === r && n === i))
    return `en~${t?.name ?? ""}~${n?.name ?? ""}`;
}
function Ac(e, t, n) {
  const r = n.cull === void 0 ? void 0 : Gc(t, n.cull), i = n.frontFace === void 0 ? void 0 : Lc(t, n.frontFace), s = n.unclippedDepth === void 0 ? void 0 : Rc(e, t, n.unclippedDepth);
  return { cullMode: r, frontFace: i, unclippedDepth: s };
}
function Rc(e, t, n) {
  if (typeof n != "boolean")
    throw zt(t, `received ${k(n)}; expected a boolean.`);
  if (n) {
    if (!e.features.has("depth-clip-control"))
      throw zt(t, 'the device lacks the "depth-clip-control" feature; request it at init: init({ requiredFeatures: ["depth-clip-control"] }) on an adapter that supports it.');
    return !0;
  }
}
function Gc(e, t) {
  if (t === "none" || t === "front" || t === "back")
    return t;
  throw Ci(e, t);
}
function Lc(e, t) {
  if (t === "ccw" || t === "cw")
    return t;
  throw Ai(e, t);
}
const Gr = { depthWriteEnabled: !0, depthCompare: "less-equal" }, Lr = ["never", "less", "equal", "less-equal", "greater", "not-equal", "greater-equal", "always"], kn = -2147483648, In = 2147483647;
function Tn(e, t) {
  if (e.depth)
    return { format: e.depth, ...t.depthState ?? Gr, ...t.stencilState ?? {} };
}
function Uc(e, t, n) {
  if (n.depth === void 0)
    return {};
  const r = Dc(e, t, n.depth, n.geometry?.topology ?? "triangle-list");
  return { depthState: r, depthKey: Mc(r) };
}
function Dc(e, t, n, r) {
  if (n === !1)
    return { depthWriteEnabled: !1, depthCompare: "always" };
  if (typeof n != "object" || n === null)
    throw O(t, `received ${k(n)}.`);
  if (n.write !== void 0 && typeof n.write != "boolean")
    throw O(t, `write must be a boolean; received ${k(n.write)}.`);
  if (n.compare !== void 0 && !Lr.includes(n.compare))
    throw O(t, `compare must be a GPUCompareFunction; received ${k(n.compare)}.`);
  if (n.bias !== void 0 && !Number.isInteger(n.bias))
    throw O(t, `bias must be an integer (WebGPU depthBias is i32); received ${k(n.bias)}.`);
  if (n.bias !== void 0 && (n.bias < kn || n.bias > In))
    throw O(t, `bias must fit in the i32 range [${kn}, ${In}] (WebGPU depthBias is i32); received ${k(n.bias)}.`);
  if (n.biasSlopeScale !== void 0 && !Number.isFinite(n.biasSlopeScale))
    throw O(t, `biasSlopeScale must be a finite number; received ${k(n.biasSlopeScale)}.`);
  if (n.biasClamp !== void 0 && !Number.isFinite(n.biasClamp))
    throw O(t, `biasClamp must be a finite number; received ${k(n.biasClamp)}.`);
  const i = n.bias ?? 0, s = n.biasSlopeScale ?? 0, o = n.biasClamp ?? 0;
  if ((i !== 0 || s !== 0 || o !== 0) && !r.startsWith("triangle"))
    throw O(t, `bias, biasSlopeScale, and biasClamp must be 0 for "${r}" topology.`);
  if (o !== 0 && e.isCompatibilityMode)
    throw O(t, `biasClamp must be 0 on a compatibility-mode device; received ${k(n.biasClamp)}.`);
  return {
    depthWriteEnabled: n.write ?? !0,
    depthCompare: n.compare ?? "less-equal",
    ...i !== 0 ? { depthBias: i } : {},
    ...s !== 0 ? { depthBiasSlopeScale: s } : {},
    ...o !== 0 ? { depthBiasClamp: o } : {}
  };
}
function Mc(e) {
  return `${e.depthWriteEnabled ? 1 : 0}~${e.depthCompare}~${e.depthBias ?? 0}~${e.depthBiasSlopeScale ?? 0}~${e.depthBiasClamp ?? 0}`;
}
const Vc = ["keep", "zero", "replace", "invert", "increment-clamp", "decrement-clamp", "increment-wrap", "decrement-wrap"];
function Oc(e, t) {
  if (t.stencil === void 0)
    return {};
  const n = t.stencil;
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw se(e, `received ${k(n)}; expected { front?, back?, readMask?, writeMask?, ref? }.`);
  const r = n.front === void 0 ? void 0 : Fn(e, "front", n.front), i = n.back === void 0 ? void 0 : Fn(e, "back", n.back);
  it(e, "readMask", n.readMask), it(e, "writeMask", n.writeMask), it(e, "ref", n.ref);
  const s = {
    ...r ? { stencilFront: r } : {},
    // Omitted back mirrors the normalized front so both faces behave the same; with neither given, both keep the WebGPU defaults.
    ...i ?? r ? { stencilBack: i ?? { ...r } } : {},
    ...n.readMask !== void 0 ? { stencilReadMask: n.readMask } : {},
    ...n.writeMask !== void 0 ? { stencilWriteMask: n.writeMask } : {}
  }, o = s.stencilFront !== void 0 || s.stencilBack !== void 0 || s.stencilReadMask !== void 0 || s.stencilWriteMask !== void 0;
  return !o && n.ref === void 0 ? {} : {
    ...o ? { stencilState: s, stencilKey: Nc(s) } : {},
    // The reference is encoder state (setStencilReference), not pipeline state; it stays out of the pipeline key.
    ...n.ref !== void 0 ? { stencilRef: n.ref } : {}
  };
}
function Fn(e, t, n) {
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw se(e, `${t} must be a { compare?, fail?, depthFail?, pass? } object; received ${k(n)}.`);
  if (n.compare !== void 0 && !Lr.includes(n.compare))
    throw se(e, `${t}.compare must be a GPUCompareFunction; received ${k(n.compare)}.`);
  for (const [r, i] of [["fail", n.fail], ["depthFail", n.depthFail], ["pass", n.pass]])
    if (i !== void 0 && !Vc.includes(i))
      throw se(e, `${t}.${r} must be a GPUStencilOperation; received ${k(i)}.`);
  return { compare: n.compare ?? "always", failOp: n.fail ?? "keep", depthFailOp: n.depthFail ?? "keep", passOp: n.pass ?? "keep" };
}
function it(e, t, n) {
  if (n !== void 0 && (typeof n != "number" || !Number.isInteger(n) || n < 0 || n > 4294967295))
    throw se(e, `${t} must be an integer in [0, 0xFFFFFFFF] (WebGPU GPUStencilValue is u32); received ${k(n)}.`);
}
function Nc(e) {
  return `st~${Pn(e.stencilFront)}~${Pn(e.stencilBack)}~${e.stencilReadMask ?? 4294967295}~${e.stencilWriteMask ?? 4294967295}`;
}
function Pn(e) {
  return e ? `${e.compare},${e.failOp},${e.depthFailOp},${e.passOp}` : "default";
}
function Cn(e, t) {
  return { count: e.sampleCount ?? 1, ...t.multisampleState ?? {} };
}
function _c(e, t) {
  if (t.multisample === void 0)
    return {};
  const n = t.multisample;
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw Ge(e, `received ${k(n)}; expected { alphaToCoverage?, mask? }.`);
  if (n.alphaToCoverage !== void 0 && typeof n.alphaToCoverage != "boolean")
    throw Ge(e, `alphaToCoverage must be a boolean; received ${k(n.alphaToCoverage)}.`);
  if (n.mask !== void 0 && (typeof n.mask != "number" || !Number.isInteger(n.mask) || n.mask < 0 || n.mask > 4294967295))
    throw Ge(e, `mask must be an integer in [0, 0xFFFFFFFF] (WebGPU GPUSampleMask is u32); received ${k(n.mask)}.`);
  const r = {
    ...n.alphaToCoverage !== void 0 ? { alphaToCoverageEnabled: n.alphaToCoverage } : {},
    ...n.mask !== void 0 ? { mask: n.mask } : {}
  };
  return r.alphaToCoverageEnabled === void 0 && r.mask === void 0 ? {} : { multisampleState: r, multisampleKey: Bc(r) };
}
function Bc(e) {
  return `ms~${e.alphaToCoverageEnabled ? 1 : 0}~${e.mask ?? 4294967295}`;
}
function Ur(e, t) {
  if (!Array.isArray(t))
    throw Bt(e, k(t));
  let n = 0;
  for (const r of t)
    if (r === "r")
      n |= 1;
    else if (r === "g")
      n |= 2;
    else if (r === "b")
      n |= 4;
    else if (r === "a")
      n |= 8;
    else
      throw Bt(e, k(r));
  return n;
}
function An(e, t) {
  return `${Dr(e)};${t ?? 15}`;
}
function Dr(e) {
  if (!e)
    return "none;none";
  const t = e.color, n = e.alpha;
  return `${t.srcFactor},${t.dstFactor},${t.operation};${n.srcFactor},${n.dstFactor},${n.operation}`;
}
function zc(e) {
  return e ? `${e.blendState ? Dr(e.blendState) : "inherit"};${e.writeMask ?? "inherit"}` : "inherit";
}
function k(e) {
  if (typeof e == "string")
    return `"${e}"`;
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}
function Wc(e) {
  return (x(e).depthState ?? Gr).depthWriteEnabled;
}
function qc(e) {
  const t = x(e), n = t.stencilState;
  if (!n || n.stencilWriteMask === 0)
    return [];
  const r = t.cullMode ?? "none", i = [], s = (o, a) => {
    if (a)
      for (const [c, u] of [["fail", a.failOp], ["depthFail", a.depthFailOp], ["pass", a.passOp]])
        u !== void 0 && u !== "keep" && i.push(`${o}.${c}: "${u}"`);
  };
  return r !== "front" && s("front", n.stencilFront), r !== "back" && s("back", n.stencilBack), i;
}
function jc(e, t, n, r = {}, i) {
  e.encode(t, n, r, i);
}
function x(e) {
  const t = Cr.get(e);
  if (!t)
    throw new TypeError("Invalid Draw instance");
  return t;
}
function Rn(e, t, n, r) {
  const i = (async () => {
    await vt(e.device), C(e.device, `${t}.validation`);
    const s = ae(t, n, r);
    e.errorSink ? await e.errorSink(s) : console.error(s);
  })();
  return e.trackSettled?.(i), i;
}
function Kc() {
  const e = /* @__PURE__ */ new Set();
  return {
    add(t) {
      e.add(t);
    },
    delete(t) {
      e.delete(t);
    },
    list() {
      return [...e];
    },
    markStale(t) {
      for (const n of e)
        n.markStale(t);
    }
  };
}
function Hc(e, t, n) {
  return e ? Array.isArray(e) ? e : e[t] ?? n : n;
}
function Yc(e, t) {
  const n = x(e);
  return gr(n.reflection.bindings, t, n.visibility).map(Xc);
}
function Xc(e) {
  return e.buffer ? { ...e, buffer: { ...e.buffer, hasDynamicOffset: !0 } } : e;
}
function Gn(e, t) {
  if (Ir(e) && !ec())
    throw Bn(t);
}
function Qc(e, t, n = {}) {
  if ("geometry" in n)
    throw G("effect", "effect() never accepts vertex buffers; use draw(gpu, { shader, geometry: geometry(gpu, descriptor) }).");
  const r = ue(e, "effect"), i = mc(r);
  return new Zc(r.device, bc(t), n, i.binds, void 0, i.pipelines, i.shaderModules, i.pipelineLayouts, (s) => r.reportError(s), (s) => {
    r.trackDelivery(s);
  });
}
const Mr = /* @__PURE__ */ new WeakMap();
class Zc {
  get gpu() {
    return X(this).gpu;
  }
  constructor(t, n, r = {}, i, s, o, a, c, u, d) {
    const f = Jc(n), h = new xc(t, f, { shader: f, set: r.set, label: r.label ?? "effect", blend: r.blend, writeMask: r.writeMask }, i, s, o, a, c, u, d);
    Mr.set(this, h);
  }
  set(t) {
    return X(this).set(t), this;
  }
  draw(t = {}) {
    X(this).draw(Xe(t) ? { target: t } : t);
  }
  compile(t) {
    return X(this).compile(t).then(() => this);
  }
  compileSync(t) {
    return X(this).compileSync(t), this;
  }
  /** @internal FramePass delegates here; not part of the frozen public Effect surface. */
  encode(t, n, r = {}, i) {
    jc(X(this), t, n, r, i);
  }
  /**
   * Frame drawable protocol: an effect is encoded as its underlying draw, so it reuses that draw's
   * protocol object — same encode path, same depth/stencil metadata for read-only passes.
   */
  get [je]() {
    return X(this)[je];
  }
}
function X(e) {
  const t = Mr.get(e);
  if (!t)
    throw new TypeError("Invalid Effect instance");
  return t;
}
function Jc(e) {
  return eu(e) ? e : `
struct VgpuFullscreenVertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};
@vertex fn vgpu_fullscreen_vs(@builtin(vertex_index) vi: u32) -> VgpuFullscreenVertexOut {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var uv = array<vec2f, 3>(vec2f(0.0, 1.0), vec2f(2.0, 1.0), vec2f(0.0, -1.0));
  var out: VgpuFullscreenVertexOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = uv[vi];
  return out;
}
${e}`;
}
function eu(e) {
  return sr(e, "effect.wgsl").entryPoints.some((t) => t.stage === "vertex");
}
const tu = $e("clock");
function nu(e) {
  return ru(ue(e, "clock"));
}
function ru(e) {
  return e.service(tu, (t) => {
    const n = At(t), r = (i) => {
      if (t.disposed)
        throw jn(i);
      C(t.device, i);
    };
    return {
      get time() {
        return r("clock.time"), n.time;
      },
      get deltaTime() {
        return r("clock.deltaTime"), n.deltaTime;
      },
      get frameCount() {
        return r("clock.frameCount"), n.frameCount;
      },
      advance(i) {
        if (r("clock.advance"), typeof i != "number" || !Number.isFinite(i) || i < 0)
          throw Yi(i);
        n.advanceBy(i);
      }
    };
  });
}
function me(e, t) {
  return Or(ue(e, "frame")).frame(t);
}
function iu(e, t, n = {}) {
  return Or(ue(e, "frameLoop")).loop(t, n);
}
let Vr;
const su = $e("frame-runner");
function Or(e) {
  return e.service(su, (t) => {
    const n = At(t);
    return new gu(() => {
      let r = () => {
      };
      const i = new ou(t.device, void 0, (s) => t.reportError(s), (s) => {
        t.trackDelivery(s);
      }, () => r());
      return r = t.own("scheduler", () => i.cancel()), i;
    }, () => n.tick(), (r) => t.own("scheduler", () => r.stop()));
  });
}
class ou {
  device;
  defaultTarget;
  errorSink;
  trackSettled;
  releaseLifecycle;
  /**
   * Resolves after submitted GPU work completes and raw claimed-bind-group
   * validation has been delivered to `gpu.onError`.
   *
   * This is a completion/timing signal only; it never rejects and is not an error
   * channel.
   */
  done = Promise.resolve();
  #e;
  #t = [];
  /**
   * Everything a pass of this frame attached, as opaque {@link FrameOwner}s: timers and
   * visibilities today, scene view generations later. The frame never learns what they are — it
   * only guarantees each one sees exactly one `frameSubmitted` or `frameAbandoned`.
   */
  #n = /* @__PURE__ */ new Set();
  /**
   * Owners whose per-frame bookkeeping a failed pass invalidated: their frame is neither finalized
   * nor read back, so a throwing pass callback cannot leave a phantom result. Kept alongside the
   * live set so a later pass re-attaching the same instance in this frame stays dropped too — the
   * failed pass's span/slots are still in that instance's frame bookkeeping.
   */
  #r = /* @__PURE__ */ new Set();
  #s = !1;
  #i = !1;
  #o = !1;
  static {
    Vr = (t) => !(#s in t) || !t.#s && !t.#i;
  }
  constructor(t, n, r, i, s) {
    this.device = t, this.defaultTarget = n, this.errorSink = r, this.trackSettled = i, this.releaseLifecycle = s, C(t, "Frame.constructor"), this.#e = t.gpu.createCommandEncoder({ label: "vgpu.frame" });
  }
  pass(t, n) {
    if (this.#i)
      throw Kt("Frame.pass");
    C(this.device, "Frame.pass");
    const r = Xe(t), i = typeof n == "function" ? n : (b) => b.draw(n), s = r ? t : t.target ?? this.defaultTarget;
    if (!s)
      throw at("Frame.pass");
    if (Ir(s) && this.#s)
      throw Bn("Frame.pass");
    const o = r ? void 0 : t.clear, a = o === !1;
    if (a && s.sampleCount === 4)
      throw Ri();
    const c = r ? void 0 : t.clearDepth;
    if (c !== void 0) {
      if (typeof c != "number" || !(c >= 0 && c <= 1))
        throw Wt(c);
      if (a)
        throw Gi();
      if (!s.depth)
        throw Wt(c, "but the target has no depth attachment, so clearDepth would have no effect.", "Create the target with depth: true (or a depth format), or drop clearDepth.");
    }
    const u = r ? void 0 : t.clearStencil;
    if (u !== void 0) {
      if (typeof u != "number" || !Number.isInteger(u) || u < 0 || u > 4294967295)
        throw qt(`received ${String(u)}; expected an integer in [0, 0xFFFFFFFF] (WebGPU GPUStencilValue).`);
      if (a)
        throw Li();
      const b = s.depth?.format;
      if (!ve(b))
        throw qt(`received ${String(u)}, but the target's depth format ${b ? `"${b}"` : "(none)"} has no stencil aspect, so clearStencil would have no effect.`);
    }
    const d = r ? void 0 : t.depthReadOnly;
    if (d !== void 0 && typeof d != "boolean")
      throw Z(`received ${K(d)}; expected a boolean.`, "Pass depthReadOnly: true to open the pass with a read-only depth attachment, or omit it.");
    if (d) {
      if (!s.depth)
        throw Z("is set, but the target has no depth attachment, so there is nothing to make read-only.", "Create the target with depth: true (or a depth format), or drop depthReadOnly.");
      if (s.sampleCount === 4)
        throw Ui();
      if (c !== void 0)
        throw Z("cannot be combined with clearDepth; a read-only depth aspect omits its load/store ops and is never cleared.", "Remove clearDepth, or drop depthReadOnly.");
      if (u !== void 0)
        throw Z("cannot be combined with clearStencil; a read-only stencil aspect omits its load/store ops and is never cleared.", "Remove clearStencil, or drop depthReadOnly.");
    }
    const f = r ? void 0 : hu(t.viewport, this.device.gpu.limits, s.size), h = r ? void 0 : pu(t.scissor, s.size), p = [];
    let w;
    try {
      const b = r || t.timer === void 0 ? void 0 : this.#a(t.timer, s, p, fu), I = (r || t.visibility === void 0 ? void 0 : this.#a(t.visibility, s, p, lu))?.occlusion;
      let y = s.renderPassDescriptor({ clear: o === void 0 || o === !0 || o === !1 ? s.clearColor ?? Pt : o, preserve: a, clearDepth: c, clearStencil: u, depthReadOnly: d });
      b?.timestampWrites && (y = { ...y, timestampWrites: b.timestampWrites }), I && (y = { ...y, occlusionQuerySet: I.querySet }), w = this.#e.beginRenderPass(y), f && w.setViewport(f.x, f.y, f.width, f.height, f.minDepth, f.maxDepth), h && w.setScissorRect(h[0], h[1], h[2], h[3]), this.#o = !0;
      try {
        i(new au(w, s, this.#t, d === !0, I, this, (v) => {
          if (C(this.device, v), this.#i)
            throw Kt(v);
        }));
      } finally {
        this.#o = !1;
      }
    } catch (b) {
      this.#d(p), R(this.#t), this.#t.length = 0, cr(this.device);
      try {
        w?.end();
      } catch {
      }
      throw b;
    }
    dr(this.device, w, this.#t);
  }
  submit() {
    if (this.#s || this.#i)
      return;
    C(this.device, "Frame.submit"), this.#s = !0, this.releaseLifecycle?.();
    for (const i of this.#f())
      i.finalizeFrame(this, this.#e);
    let t;
    const n = this.#t[0]?.context;
    n && ye(this.device, n);
    try {
      t = this.#e.finish();
    } catch (i) {
      this.#c(this.#u());
      const s = n ? D(this.device) : void 0;
      R(this.#t), s && R([s]);
      const o = s?.context ?? n;
      if (!o)
        throw i;
      this.done = this.#h(this.#l(o.label, o.group, i));
      return;
    }
    if (n) {
      const i = D(this.device);
      i && (this.#t[0] = this.#t[0] ? ze(i, this.#t[0]) : i);
    }
    const r = this.#t[0]?.context;
    r && ye(this.device, r);
    try {
      this.device.gpu.queue.submit([t]);
    } catch (i) {
      this.#c(this.#u());
      const s = r ? D(this.device) : void 0;
      R(this.#t), s && R([s]);
      const o = s?.context ?? r;
      if (!o)
        throw i;
      this.done = this.#h(this.#l(o.label, o.group, i));
      return;
    }
    if (r) {
      const i = D(this.device);
      i && (this.#t[0] = this.#t[0] ? ze(i, this.#t[0]) : i);
    }
    for (const i of this.#f())
      i.frameSubmitted(this);
    this.#c(this.#r), this.done = this.#h(ur(this.device, this.#t, { errorSink: this.errorSink }));
  }
  /**
   * Discards the frame without submitting it: the command encoder is dropped (nothing this frame
   * encoded ever runs) and every telemetry instance it attached releases the retain it took on its
   * query ring, so a `timer(gpu)` / `visibility(gpu)` can be disposed for good without waiting for
   * `gpu.dispose()`. This is the explicit way out of the leak a manual `frame(gpu)` would otherwise
   * hold: a frame is never assumed abandoned, because an old frame can still be submitted.
   *
   * Idempotent, like `submit()`: cancelling twice is a no-op, and `submit()` after `cancel()` does
   * nothing. Cancelling a frame that was already submitted throws `VGPU-FRAME-SUBMITTED` — its work
   * is on the queue and cannot be taken back, so silently accepting the call would hide a real
   * lifecycle bug.
   */
  cancel() {
    if (!this.#i) {
      if (this.#s)
        throw Qi("Frame.cancel");
      if (this.#o)
        throw Xi("Frame.cancel");
      this.#i = !0, this.releaseLifecycle?.(), this.#c(this.#u()), this.#n.clear(), this.#r.clear(), R(this.#t), this.#t.length = 0;
    }
  }
  /**
   * Ends the frame for telemetry instances that will never see a real frameSubmitted: a pass whose
   * callback threw, a frame whose finish/submit failed, or a canceled frame. Each one took a retain
   * on its query ring when it was attached to a pass descriptor (so a mid-frame dispose() cannot
   * destroy a set the frame still points at); without the matching release, a dispose() after the
   * failure leaves the ring alive forever. frameAbandoned() drops the instance's pending encoded
   * state as it releases: a resolve that never reached the queue must not be decoded — its staging
   * buffer holds stale bytes, which would surface as a phantom duration or a phantom "hidden".
   */
  #c(t) {
    for (const n of [...t])
      n.frameAbandoned(this);
  }
  /** Every owner this frame attached, discarded ones included. */
  #u() {
    return [...this.#n, ...this.#r];
  }
  /** Moves owners out of this frame's live set: they are neither finalized nor read back. */
  #d(t) {
    for (const n of [...t])
      this.#n.delete(n), this.#r.add(n);
  }
  #f() {
    return [...this.#n].filter((t) => !this.#r.has(t));
  }
  /**
   * Attaches one `FramePassOptions` telemetry value to this pass through the nominal attachment
   * protocol, so the frame never learns whether it is a timer span, a visibility or a future
   * scene-view generation: it only records the owner it must settle exactly once.
   */
  #a(t, n, r, i) {
    const s = lc(t);
    if (!s)
      throw i(t);
    let o;
    try {
      o = s[Pr]({ frame: this, device: this.device, target: n });
    } catch (a) {
      throw this.#d(this.#n), a;
    }
    return this.#n.add(o.owner), r.push(o.owner), o;
  }
  async #l(t, n, r) {
    await vt(this.device), C(this.device, "Frame.validation");
    const i = ae(t, n, r);
    this.errorSink ? await this.errorSink(i) : console.error(i);
  }
  #h(t) {
    return this.trackSettled?.(t), t;
  }
}
class au {
  encoder;
  target;
  validations;
  depthReadOnly;
  occlusionSource;
  frame;
  assertFrameOpen;
  #e = !1;
  constructor(t, n, r, i = !1, s, o, a) {
    this.encoder = t, this.target = n, this.validations = r, this.depthReadOnly = i, this.occlusionSource = s, this.frame = o, this.assertFrameOpen = a;
  }
  draw(t, n = {}) {
    this.assertFrameOpen?.("FramePass.draw");
    const r = uu(t);
    this.depthReadOnly && cu(r, this.target), r.encode(this.encoder, this.target, n, (i) => this.validations.push(i));
  }
  /**
   * Wraps one or more draws in begin/endOcclusionQuery. The body ALWAYS executes; condition your
   * real draws on `q.hidden` outside.
   */
  occlusion(t, n) {
    if (this.assertFrameOpen?.("FramePass.occlusion"), !this.occlusionSource)
      throw Vi();
    if (this.#e)
      throw Oi();
    const r = this.occlusionSource.beginQuery(t, this.frame);
    this.encoder.beginOcclusionQuery(r), this.#e = !0;
    try {
      typeof n == "function" ? n() : this.draw(n);
    } finally {
      this.#e = !1, this.encoder.endOcclusionQuery();
    }
  }
  bundles(...t) {
    if (this.assertFrameOpen?.("FramePass.bundles"), this.depthReadOnly)
      throw Z("pass cannot replay bundles: bundle records bundles with writable depth/stencil, and WebGPU only executes read-only-recorded bundles in a read-only pass.", "Encode the draws directly with pass.draw(...) inside the depthReadOnly pass.", "FramePass.bundles");
    const n = t.map((r) => fc(r) ?? du());
    for (const r of n)
      r.assertReplayable(this.target);
    this.encoder.executeBundles(n.map((r) => r.gpu));
  }
}
function cu(e, t) {
  if (e.writesDepth())
    throw Z(`pass cannot encode draw '${e.label}': its depth state writes depth (the default is write: true). Give the draw depth: { write: false } (or depth: false to disable depth testing).`, "Use depth: { write: false } on the draw, or open the pass without depthReadOnly.", "FramePass.draw");
  if (ve(t.depth?.format)) {
    const n = e.stencilWritingOps();
    if (n.length)
      throw Z(`pass cannot encode draw '${e.label}': its stencil ops can write (${n.join(", ")}), and the pass's stencil aspect is read-only too.`, 'Use "keep" for those ops or stencil writeMask: 0, or open the pass without depthReadOnly.', "FramePass.draw");
  }
}
function uu(e) {
  const t = uc(e);
  if (!t)
    throw new TypeError("Invalid Effect instance: pass.draw() expects a Draw or an Effect created by this library.");
  return t;
}
function du() {
  throw new g({ code: "VGPU-R3-BUNDLE-INVALID", message: "p.bundles() expected bundles created by bundle(gpu, { target }, cb).", where: "FramePass.bundles" });
}
function fu(e) {
  return Di(`FramePassOptions.timer received ${K(e)}; expected a TimerSpan from timer.span(name).`, 'Create const passTimer = timer(gpu) once, then pass passTimer.span("name") per pass.', "Frame.pass");
}
function lu(e) {
  return Mi(`FramePassOptions.visibility received ${K(e)}; expected a Visibility from visibility(gpu).`, "Create const vis = visibility(gpu) once, then pass { target, visibility: vis } per pass.", "Frame.pass");
}
function hu(e, t, n) {
  if (e === void 0)
    return;
  if (typeof e != "object" || e === null || Array.isArray(e))
    throw N(`received ${K(e)}; expected { x?, y?, width, height, minDepth?, maxDepth? }.`);
  const { x: r = 0, y: i = 0, width: s, height: o, minDepth: a = 0, maxDepth: c = 1 } = e;
  for (const [h, p] of [["x", r], ["y", i], ["width", s], ["height", o], ["minDepth", a], ["maxDepth", c]])
    if (typeof p != "number" || !Number.isFinite(p))
      throw N(`${h} received ${K(p)}; expected a finite number.`);
  const u = t.maxTextureDimension2D, d = u * 2, f = `target is ${n[0]}x${n[1]}px, device maxTextureDimension2D is ${u}`;
  if (!(s >= 0 && s <= u))
    throw N(`width ${s} is outside [0, ${u}] (${f}).`);
  if (!(o >= 0 && o <= u))
    throw N(`height ${o} is outside [0, ${u}] (${f}).`);
  if (!(r >= -d && r + s <= d - 1))
    throw N(`x ${r} with width ${s} is outside [${-d}, ${d - 1}] (${f}).`);
  if (!(i >= -d && i + o <= d - 1))
    throw N(`y ${i} with height ${o} is outside [${-d}, ${d - 1}] (${f}).`);
  if (!(a >= 0 && a <= 1))
    throw N(`minDepth ${a} is outside [0, 1].`);
  if (!(c >= 0 && c <= 1))
    throw N(`maxDepth ${c} is outside [0, 1].`);
  if (!(a <= c))
    throw N(`minDepth ${a} exceeds maxDepth ${c}.`);
  return { x: r, y: i, width: s, height: o, minDepth: a, maxDepth: c };
}
function pu(e, t) {
  if (e === void 0)
    return;
  if (!Array.isArray(e) || e.length !== 4)
    throw et(`received ${K(e)}; expected [x, y, width, height].`);
  const [n, r, i, s] = e;
  for (const [c, u] of [["x", n], ["y", r], ["width", i], ["height", s]])
    if (typeof u != "number" || !Number.isInteger(u) || u < 0)
      throw et(`${c} received ${K(u)}; expected a non-negative integer.`);
  const [o, a] = t;
  if (n + i > o || r + s > a)
    throw et(`[${n}, ${r}, ${i}, ${s}] exceeds the target's current size ${o}x${a}px (x + width <= ${o}, y + height <= ${a}).`);
  return [n, r, i, s];
}
function K(e) {
  return typeof e == "string" ? `'${e}'` : Array.isArray(e) ? `[${e.map((t) => K(t)).join(", ")}]` : typeof e == "object" && e !== null ? "an object" : String(e);
}
function mu(e) {
  const t = e?.code;
  return t === "VGPU-DEVICE-DISPOSED" || t === "VGPU-DEVICE-LOST";
}
class gu {
  createFrame;
  advance;
  trackLoop;
  #e = !1;
  /**
   * @param trackLoop Lifecycle hook for the owning gpu: called with each started loop handle and
   * returns the untrack function the handle runs when it stops on its own, so `gpu.dispose()` can
   * stop the loops still running without holding on to the ones already stopped.
   */
  constructor(t, n, r) {
    this.createFrame = t, this.advance = n, this.trackLoop = r;
  }
  frame(t) {
    if (this.#e || Ja())
      throw zn();
    this.#e = !0, tc();
    try {
      this.advance();
      const n = this.createFrame();
      if (t) {
        try {
          t(n);
        } catch (r) {
          if (Vr(n))
            try {
              n.cancel();
            } catch {
            }
          throw r;
        }
        try {
          n.submit();
        } catch (r) {
          if (!mu(r))
            throw r;
        }
      }
      return n;
    } finally {
      nc(), this.#e = !1;
    }
  }
  loop(t, n = {}) {
    let r = !1;
    const i = globalThis.requestAnimationFrame ?? ((p) => setTimeout(() => p(performance.now()), 16)), s = globalThis.cancelAnimationFrame ?? ((p) => clearTimeout(p)), o = n.fps && n.fps > 0 ? 1e3 / n.fps : 0;
    let a, c = 0, u;
    const d = () => {
      r = !0, s(c), u?.(), u = void 0;
    }, f = (p) => {
      if (!r) {
        if (bu(p, a, o)) {
          a = p;
          try {
            this.frame(t);
          } catch (w) {
            throw d(), w;
          }
        }
        r || (c = i(f));
      }
    };
    c = i(f);
    const h = { stop: d };
    return u = this.trackLoop?.(h), h;
  }
}
function bu(e, t, n) {
  return t === void 0 || n <= 0 ? !0 : e - t >= n;
}
function wu(e, t) {
  return new yu(ue(e, "target").device, t);
}
class yu {
  device;
  options;
  resourceIdentity = Ke("render-target");
  #e = new He();
  #t = /* @__PURE__ */ new Set();
  #n;
  #r;
  #s;
  #i;
  #o;
  constructor(t, n) {
    this.device = t, this.options = n, Ta(n, t), this.#o = n.clearColor === void 0 ? Pt : We(n.clearColor, "target.clearColor"), this.#n = n.size, this.#r = this.#f(), this.#s = this.sampleCount === 4 ? this.#a() : void 0, this.#i = this.#l();
  }
  get gpu() {
    return this.color.gpu;
  }
  get size() {
    return this.#n;
  }
  get texelSize() {
    return [1 / this.#n[0], 1 / this.#n[1]];
  }
  /** Resolved, sampleable color texture. For MSAA targets, render passes resolve into this texture. */
  get color() {
    return this.#r[0];
  }
  /** Resolved, sampleable color textures. For MSAA targets, render passes resolve into these textures. */
  get colors() {
    return this.#r;
  }
  get depth() {
    return this.#i;
  }
  get format() {
    return Me(this.options)[0]?.format ?? "rgba8unorm";
  }
  /** Default clear color of this target; passes that clear without naming a color use it. */
  get clearColor() {
    return Ct(this.#o);
  }
  set clearColor(t) {
    this.#o = We(t, "target.clearColor");
  }
  get sampleCount() {
    return yr(this.options);
  }
  resize(t) {
    Sr(this.#n, t) || this.#c(t);
  }
  async read() {
    return this.color.read();
  }
  async readFloats() {
    return this.color.readFloats();
  }
  onDestroy(t) {
    return this.#e.onDestroy(this, t);
  }
  onTexturesRecreated(t) {
    return this.#t.add(t), () => {
      this.#t.delete(t);
    };
  }
  destroy() {
    this.#e.emit(this), this.#t.clear(), this.#d();
  }
  renderPassDescriptor(t = {}) {
    const { clear: n = [0, 0, 0, 1], preserve: r, clearDepth: i, clearStencil: s, depthReadOnly: o } = t;
    return {
      colorAttachments: this.#r.map((a, c) => Pa(a, this.#s?.[c], n, r)),
      depthStencilAttachment: this.#i ? Ca(this.#i, r, i, s, o) : void 0
    };
  }
  #c(t) {
    this.#d(), this.#n = [t[0], t[1]], this.#r = this.#f(), this.#s = this.sampleCount === 4 ? this.#a() : void 0, this.#i = this.#l(), this.#u();
  }
  #u() {
    for (const t of [...this.#t])
      t();
  }
  #d() {
    for (const t of this.#r)
      t.destroy();
    for (const t of this.#s ?? [])
      t.destroy();
    this.#i?.destroy();
  }
  #f() {
    return Me(this.options).map((t, n) => this.device.createTexture({
      size: this.#n,
      format: t.format,
      usage: ["render_attachment", "texture_binding", "copy_src"],
      sampleCount: 1,
      label: this.options.label ? `${this.options.label}.color${n}.resolve` : void 0
    }));
  }
  #a() {
    return Me(this.options).map((t, n) => this.device.createTexture({
      size: this.#n,
      format: t.format,
      usage: ["render_attachment"],
      sampleCount: 4,
      label: this.options.label ? `${this.options.label}.color${n}` : void 0
    }));
  }
  #l() {
    const t = wr(this.options);
    return t ? this.device.createTexture({
      size: this.#n,
      format: t,
      usage: ["render_attachment", "texture_binding"],
      sampleCount: this.sampleCount,
      label: this.options.label ? `${this.options.label}.depth` : void 0
    }) : void 0;
  }
}
function xu(e) {
  return is("browser", e);
}
const Su = { version: 1, wgsl: "struct AtmosphereParams{time:f32,scroll:f32,resolution:vec2f,intensity:f32,quality:f32,}@group(0) @binding(0) var<uniform> params:AtmosphereParams;fn hash21(a:vec2f)-> f32{let b=fract(a*vec2f(123.34,456.21));return fract((b.x+dot(b,b+45.32))*(b.y+19.19));}fn valueNoise(a:vec2f)-> f32{let b=floor(a);let c=fract(a);let d=c*c*(3.0-2.0*c);let e=hash21(b);let f=hash21(b+vec2f(1.0,0.0));let g=hash21(b+vec2f(0.0,1.0));let h=hash21(b+vec2f(1.0,1.0));return mix(mix(e,f,d.x),mix(g,h,d.x),d.y);}fn fbm(a:vec2f)-> f32{var b=a;var c=0.0;var d=0.5;for(var e=0;e<4;e=e+1){c+=valueNoise(b)*d;b=b*2.03+vec2f(7.1,3.7);d*=0.5;}return c;}fn softLine(a:f32,b:f32,c:f32)-> f32{return exp(-abs(a-b)/max(c,0.0001));}@fragment fn fs_main(@location(0) a:vec2f)-> @location(0) vec4f{let b=params.resolution.x/max(params.resolution.y,1.0);let c=vec2f((a.x-0.5)*b,a.y-0.5);let d=vec2f(params.time*0.006,-params.time*0.004+params.scroll*1.7);let e=fbm(c*2.15+d);var f=0.48;if(params.quality>0.5){f=fbm(c*5.4-d*1.8+13.7);}let g=smoothstep(0.34,0.82,e*0.76+f*0.34);let h=smoothstep(0.02,0.92,a.y)*(0.62+0.38*sin((a.y+params.scroll)*3.14159));let i=softLine(a.x,0.035,0.032);let j=softLine(a.x,0.965,0.038);let k=0.88+0.12*sin(params.time*0.33+params.scroll*5.0);let l=(i*0.86+j)*k;let m=vec2f(floor(a.x*92.0),floor((a.y+params.time*0.055)*46.0));let n=hash21(m);let o=fract(vec2f(a.x*92.0,(a.y+params.time*0.055)*46.0));let p=step(0.982,n)*smoothstep(0.10,0.48,o.y)*smoothstep(0.94,0.62,o.y)*exp(-abs(o.x-n)*34.0);let q=g*h*mix(0.055,0.105,params.quality);let r=l*0.135+p*0.13;let s=clamp((q+r)*params.intensity,0.0,0.30);let t=vec3f(0.08,0.72,0.72);let u=vec3f(1.0,0.025,0.085);let v=vec3f(1.0,0.035,0.56);let w=vec3f(0.58,0.88,0.86);let z=vec3f(0.002,0.009,0.012);let A=mix(z,t*0.10,g*0.25);let B=mix(u,v,clamp(j/max(i+j,0.0001),0.0,1.0));let C=A*q+B*l*0.115+w*p*0.09;return vec4f(C*params.intensity,s);}", functionExports: [] }, st = (e, t, n) => Math.min(n, Math.max(t, e));
async function $u(e, t = {}) {
  if (!navigator.gpu) {
    const y = new Error("WebGPU is not available in this browser.");
    throw y.code = "MILKY_WEBGPU_UNAVAILABLE", y;
  }
  const n = t.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches, r = matchMedia("(pointer: coarse)").matches, i = await xu(), s = Xa(i, e, {
    autoResize: !1,
    alphaMode: "premultiplied",
    clearColor: [0, 0, 0, 0],
    label: "MILKY vGPU atmosphere"
  }), o = nu(i), a = {
    enabled: !0,
    intensity: 1,
    scroll: 0,
    quality: r ? "low" : "high",
    qualityReason: r ? "coarse-pointer" : "initial",
    slowFrames: 0,
    presentedFrames: 0,
    lastPresentedAt: 0,
    disposed: !1
  }, c = Qc(i, Su, {
    label: "neon fog and rain",
    set: {
      params: {
        time: n ? 4 : 0,
        scroll: 0,
        resolution: [1, 1],
        intensity: 1,
        quality: a.quality === "high" ? 1 : 0
      }
    }
  });
  let u = null, d = !1;
  function f() {
    const y = window.devicePixelRatio || 1;
    return a.quality === "high" ? st(y, 0.72, 1) : 0.52;
  }
  function h() {
    if (a.disposed) return;
    const y = e.getBoundingClientRect(), v = f();
    s.resize([
      Math.max(1, Math.round(y.width * v)),
      Math.max(1, Math.round(y.height * v))
    ]), c.set({ params: { resolution: s.size } });
  }
  function p(y) {
    c.set({
      params: {
        time: n ? 4 : o.time,
        scroll: a.scroll,
        intensity: a.enabled ? a.intensity : 0,
        quality: a.quality === "high" ? 1 : 0
      }
    }), y.pass({ target: s, clear: [0, 0, 0, 0] }, c);
  }
  function w() {
    const y = performance.now();
    if (a.lastPresentedAt > 0 && document.visibilityState === "visible") {
      const v = y - a.lastPresentedAt;
      a.slowFrames = v > 48 ? a.slowFrames + 1 : Math.max(0, a.slowFrames - 2), a.quality === "high" && a.presentedFrames > 75 && a.slowFrames >= 24 && !d && (d = !0, queueMicrotask(() => $("low", "frame-health")));
    }
    a.lastPresentedAt = y, a.presentedFrames += 1;
  }
  function b() {
    if (u?.stop(), a.lastPresentedAt = 0, n) {
      me(i, p);
      return;
    }
    u = iu(i, (y) => {
      p(y), w();
    }, { fps: a.quality === "high" ? 30 : 20 });
  }
  function $(y, v = "manual") {
    a.disposed || y === a.quality || !["high", "low"].includes(y) || (a.quality = y, a.qualityReason = v, a.slowFrames = 0, a.presentedFrames = 0, d = !1, h(), e.dataset.vgpuQuality = y, e.dataset.vgpuReason = v, b(), console.info("[MILKY vGPU] quality changed", { quality: y, reason: v, size: s.size }));
  }
  const I = new ResizeObserver(h);
  return I.observe(e), h(), await c.compile({ colors: [s.format] }), me(i, p), e.dataset.vgpuReady = "true", e.dataset.vgpuQuality = a.quality, e.dataset.vgpuReason = a.qualityReason, b(), {
    state: a,
    gpu: i,
    output: s,
    setScroll(y) {
      a.scroll = st(y, 0, 1);
    },
    setEnabled(y) {
      a.enabled = !!y, n && me(i, p);
    },
    setIntensity(y) {
      a.intensity = st(y, 0, 1.35);
    },
    setQuality: $,
    renderOnce() {
      me(i, p);
    },
    async readDiagnosticPixels(y = [320, 180]) {
      const v = wu(i, {
        size: y,
        format: "rgba8unorm",
        clearColor: [0, 0, 0, 0],
        label: "MILKY vGPU diagnostic"
      });
      c.set({ params: { resolution: v.size } }), me(i, (F) => {
        F.pass({ target: v, clear: [0, 0, 0, 0] }, c);
      }), await i.settled();
      const A = await v.read();
      return v.destroy(), c.set({ params: { resolution: s.size } }), A;
    },
    dispose() {
      a.disposed || (a.disposed = !0, u?.stop(), I.disconnect(), s.dispose(), i.dispose(), delete e.dataset.vgpuReady);
    }
  };
}
export {
  $u as createVgpuAtmosphere
};
//# sourceMappingURL=vgpu-atmosphere.js.map
