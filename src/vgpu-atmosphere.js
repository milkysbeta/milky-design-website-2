import { clock, effect, frame, frameLoop, init, surface, target } from 'vgpu';
import atmosphereShader from './shaders/neon-atmosphere.wgsl';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Lightweight WebGPU layer over the established Three.js forest.
 * The forest keeps the geometry/interaction work; vGPU owns only this single
 * transparent fullscreen atmosphere pass.
 */
export async function createVgpuAtmosphere(canvas, options = {}) {
  if (!navigator.gpu) {
    const error = new Error('WebGPU is not available in this browser.');
    error.code = 'MILKY_WEBGPU_UNAVAILABLE';
    throw error;
  }

  const reducedMotion = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  const gpu = await init();
  const output = surface(gpu, canvas, {
    autoResize: false,
    alphaMode: 'premultiplied',
    clearColor: [0, 0, 0, 0],
    label: 'MILKY vGPU atmosphere'
  });
  const time = clock(gpu);
  const state = {
    enabled: true,
    intensity: 1,
    scroll: 0,
    quality: coarsePointer ? 'low' : 'high',
    qualityReason: coarsePointer ? 'coarse-pointer' : 'initial',
    slowFrames: 0,
    presentedFrames: 0,
    lastPresentedAt: 0,
    disposed: false
  };

  const atmosphere = effect(gpu, atmosphereShader, {
    label: 'neon fog and rain',
    set: {
      params: {
        time: reducedMotion ? 4 : 0,
        scroll: 0,
        resolution: [1, 1],
        intensity: 1,
        quality: state.quality === 'high' ? 1 : 0
      }
    }
  });

  let loop = null;
  let downgradeQueued = false;

  function tierDpr() {
    const deviceDpr = window.devicePixelRatio || 1;
    return state.quality === 'high' ? clamp(deviceDpr, 0.72, 1) : 0.52;
  }

  function resize() {
    if (state.disposed) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = tierDpr();
    output.resize([
      Math.max(1, Math.round(rect.width * dpr)),
      Math.max(1, Math.round(rect.height * dpr))
    ]);
    atmosphere.set({ params: { resolution: output.size } });
  }

  function renderFrame(currentFrame) {
    atmosphere.set({
      params: {
        time: reducedMotion ? 4 : time.time,
        scroll: state.scroll,
        intensity: state.enabled ? state.intensity : 0,
        quality: state.quality === 'high' ? 1 : 0
      }
    });
    currentFrame.pass({ target: output, clear: [0, 0, 0, 0] }, atmosphere);
  }

  function recordFrameHealth() {
    const now = performance.now();
    if (state.lastPresentedAt > 0 && document.visibilityState === 'visible') {
      const elapsed = now - state.lastPresentedAt;
      // A 30 FPS pass has a 33 ms budget. Ignore isolated layout/GC hitches;
      // downgrade only after a sustained run of misses.
      state.slowFrames = elapsed > 48 ? state.slowFrames + 1 : Math.max(0, state.slowFrames - 2);
      if (state.quality === 'high' && state.presentedFrames > 75 && state.slowFrames >= 24 && !downgradeQueued) {
        downgradeQueued = true;
        queueMicrotask(() => setQuality('low', 'frame-health'));
      }
    }
    state.lastPresentedAt = now;
    state.presentedFrames += 1;
  }

  function startLoop() {
    loop?.stop();
    state.lastPresentedAt = 0;
    if (reducedMotion) {
      frame(gpu, renderFrame);
      return;
    }
    loop = frameLoop(gpu, (currentFrame) => {
      renderFrame(currentFrame);
      recordFrameHealth();
    }, { fps: state.quality === 'high' ? 30 : 20 });
  }

  function setQuality(next, reason = 'manual') {
    if (state.disposed || next === state.quality || !['high', 'low'].includes(next)) return;
    state.quality = next;
    state.qualityReason = reason;
    state.slowFrames = 0;
    state.presentedFrames = 0;
    downgradeQueued = false;
    resize();
    canvas.dataset.vgpuQuality = next;
    canvas.dataset.vgpuReason = reason;
    startLoop();
    console.info('[MILKY vGPU] quality changed', { quality: next, reason, size: output.size });
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  // Surface swapchain textures only exist while a frame is being encoded;
  // warm the matching platform format without acquiring one early.
  await atmosphere.compile({ colors: [output.format] });
  frame(gpu, renderFrame);
  canvas.dataset.vgpuReady = 'true';
  canvas.dataset.vgpuQuality = state.quality;
  canvas.dataset.vgpuReason = state.qualityReason;
  startLoop();

  return {
    state,
    gpu,
    output,
    setScroll(value) {
      state.scroll = clamp(value, 0, 1);
    },
    setEnabled(value) {
      state.enabled = Boolean(value);
      if (reducedMotion) frame(gpu, renderFrame);
    },
    setIntensity(value) {
      state.intensity = clamp(value, 0, 1.35);
    },
    setQuality,
    renderOnce() {
      frame(gpu, renderFrame);
    },
    async readDiagnosticPixels(size = [320, 180]) {
      const diagnostic = target(gpu, {
        size,
        format: 'rgba8unorm',
        clearColor: [0, 0, 0, 0],
        label: 'MILKY vGPU diagnostic'
      });
      atmosphere.set({ params: { resolution: diagnostic.size } });
      frame(gpu, (currentFrame) => {
        currentFrame.pass({ target: diagnostic, clear: [0, 0, 0, 0] }, atmosphere);
      });
      await gpu.settled();
      const pixels = await diagnostic.read();
      diagnostic.destroy();
      atmosphere.set({ params: { resolution: output.size } });
      return pixels;
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      loop?.stop();
      resizeObserver.disconnect();
      output.dispose();
      gpu.dispose();
      delete canvas.dataset.vgpuReady;
    }
  };
}
