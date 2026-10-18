import { createForest } from './forest.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let forest = null;
let vgpuAtmosphere = null;
let atmosphereOn = true;
let currentSection = null;
let lastScrollY = 0;
let scrollTicking = false;

function setForestLook() {
  if (!forest) return;

  // Photographic grade: a wet near canopy caught in one broad key light,
  // restrained mid foliage, and rear planting swallowed by near-black fog.
  forest.setExposure(0.76);
  forest.setAmbient(0.48);
  forest.setFrontSpot(0.72);
  forest.setWetLeaf(0.94);
  forest.setLeafGloss(1.08);
  forest.setWetTop(0.78);
  forest.setVeinGlow(0.60);
  forest.setStripOnLeaf(0.23);
  forest.setGreenGlow(0.18);
  forest.setLeafWrap(0.48);
  forest.setLeafDark(0.55);
  forest.setDepthContrast(3.05);
  forest.setDepthDim(0.22);
  forest.setStemFade(0.018);
  forest.setTipLight(0.045);
  forest.setLeafSpot(0.030);
  forest.setLeafTone([0.31, 0.65, 0.78], [0.48, 0.83, 0.72], 16);
  forest.setRimPink(0);
  forest.setEdgeSoft(0.76);
  forest.setRubber(1.38);
  forest.setPanelOpacity(0.76);
  forest.setRimStrength(0.26);
  // Fine, recessive condensation: present on the glass, but never competing
  // with the work. Size is in screen pixels so it remains restrained at every
  // panel height.
  forest.setDropScale(138);
  forest.setWetGain(0.46);
  forest.setFocus(0.038, 0.22);
  forest.setTilt(0.48, 0.20, 0.48, 0.48);
  forest.setMist(0.90);
  forest.setWet(1);
}

async function bootForest() {
  try {
    const response = await fetch('data/layout.json', { cache: 'no-cache' });
    const layout = response.ok ? await response.json() : null;
    forest = createForest($('#forest'), { layout });
    window.__milky2 = forest;
    setForestLook();
  } catch (error) {
    console.warn('[MILKY 2] WebGL scene unavailable; using the art-directed fallback.', error);
    document.documentElement.classList.add('no-webgl');
  }
}

async function bootVgpuAtmosphere() {
  const canvas = $('#vgpuAtmosphere');
  if (!canvas) return;

  try {
    const { createVgpuAtmosphere } = await import('./vgpu-atmosphere.js');
    vgpuAtmosphere = await createVgpuAtmosphere(canvas, { reducedMotion });
    vgpuAtmosphere.setEnabled(atmosphereOn);
    window.__milky2Vgpu = vgpuAtmosphere;
  } catch (error) {
    document.documentElement.classList.add('no-vgpu');
    if (error?.code === 'MILKY_WEBGPU_UNAVAILABLE') {
      console.info('[MILKY 2] WebGPU atmosphere unavailable; the Three.js forest remains active.');
    } else {
      console.warn('[MILKY 2] vGPU atmosphere unavailable; the Three.js forest remains active.', error);
    }
  }
}

function measuredRects(selector, padding = 0) {
  const viewportHeight = innerHeight;
  const candidates = [];

  $$(selector).forEach((element) => {
    if (element.offsetParent === null) return;
    const rect = element.getBoundingClientRect();
    if (rect.bottom < -viewportHeight * .35 || rect.top > viewportHeight * 1.35) return;
    candidates.push({
      left: rect.left - padding,
      top: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) || 2,
      distance: Math.abs(rect.top + rect.height * .5 - viewportHeight * .5)
    });
  });

  return candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)
    .map(({ distance, ...rect }) => rect);
}

function panelRects() {
  return measuredRects('[data-glass]');
}

function avoidanceRects() {
  const padding = Math.max(16, Math.min(30, Math.min(innerWidth, innerHeight) * .032));
  return measuredRects('[data-foliage-solid]', padding);
}

function updateScroll() {
  scrollTicking = false;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
  const percentage = String(Math.round(progress * 100)).padStart(2, '0');

  forest?.setScroll(progress);
  vgpuAtmosphere?.setScroll(progress);
  $('#scrollProgress').style.height = `${progress * 100}%`;
  $('#scrollPercent').textContent = `${percentage}%`;
  $('#siteHead').classList.toggle('is-stuck', scrollY > 30);

  const goingDown = scrollY > lastScrollY;
  $('#siteHead').classList.toggle('is-hidden', goingDown && scrollY > innerHeight * .8 && !document.body.classList.contains('menu-open'));
  lastScrollY = scrollY;

  const sections = $$('.tracked-section');
  let nearest = sections[0];
  let nearestDistance = Infinity;
  sections.forEach((section) => {
    const distance = Math.abs(section.getBoundingClientRect().top - innerHeight * .35);
    if (distance < nearestDistance) {
      nearest = section;
      nearestDistance = distance;
    }
  });

  if (nearest && nearest !== currentSection) {
    currentSection = nearest;
    $('#sectionNumber').textContent = nearest.dataset.number;
    $('#sectionName').textContent = nearest.dataset.section;
  }
}

function requestScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScroll);
}

function installPointer() {
  addEventListener('pointermove', (event) => {
    const x = event.clientX / innerWidth;
    const y = event.clientY / innerHeight;
    forest?.setMouse(x * 2 - 1, -(y * 2 - 1));
  }, { passive: true });
}

function installRevealObservers() {
  if (reducedMotion) {
    $$('.reveal').forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      instance.unobserve(entry.target);
    });
  }, { threshold: .09, rootMargin: '0px 0px -7% 0px' });

  $$('.reveal').forEach((element) => observer.observe(element));
}

function installVideoPlayback() {
  const previewFrames = $$('.project__frame');
  const rateFrames = new WeakMap();
  // The capture files are already authored at one-quarter speed and 60 fps.
  // Playing them at 1x keeps the requested visual pace without 24 fps stepping.
  const idleRate = .25;
  const hoverRate = 1;

  const stopRateRamp = (video) => {
    const frame = rateFrames.get(video);
    if (frame) cancelAnimationFrame(frame);
    rateFrames.delete(video);
  };

  const rampRate = (video, target = hoverRate, duration = 1200) => {
    stopRateRamp(video);
    const from = Math.max(idleRate, video.playbackRate || idleRate);
    const started = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      video.playbackRate = from + (target - from) * eased;
      if (t < 1) rateFrames.set(video, requestAnimationFrame(tick));
      else rateFrames.delete(video);
    };

    rateFrames.set(video, requestAnimationFrame(tick));
  };

  previewFrames.forEach((frame) => {
    const video = $('video', frame);
    if (!video) return;

    video.pause();
    video.playbackRate = idleRate;

    const start = () => {
      if (reducedMotion) return;
      video.play().catch(() => {});
      /* Start the easing clock immediately. Waiting for play() meant a cold,
         unbuffered capture could remain at the initial crawl for several
         seconds even though the pointer was already over it. */
      rampRate(video, hoverRate, 1250);
    };
    const stop = () => {
      stopRateRamp(video);
      video.pause();
      video.playbackRate = idleRate;
    };

    frame.addEventListener('pointerenter', start);
    frame.addEventListener('pointerleave', stop);
    frame.addEventListener('focusin', start);
    frame.addEventListener('focusout', (event) => {
      if (!frame.contains(event.relatedTarget)) stop();
    });
  });

  // Non-project material studies can still animate when visible. The website
  // captures above remain authored hover objects, never viewport autoplay.
  const videos = $$('video').filter((video) => !video.closest('.project__frame'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting && !reducedMotion) video.play().catch(() => {});
      else video.pause();
    });
  }, { threshold: .28, rootMargin: '15% 0px 15% 0px' });
  videos.forEach((video) => observer.observe(video));
}

function installWeightedScroll() {
  if (reducedMotion || !matchMedia('(pointer: fine)').matches) return;

  const root = document.documentElement;
  let current = scrollY;
  let target = scrollY;
  let scrollFrame = null;
  let previousScrollBehavior = '';
  let previousScrollSnapType = '';

  const maxScroll = () => Math.max(0, root.scrollHeight - innerHeight);
  const clampTarget = (value) => Math.min(maxScroll(), Math.max(0, value));

  const canNestedElementScroll = (eventTarget, delta) => {
    let element = eventTarget instanceof Element ? eventTarget : null;
    while (element && element !== document.body) {
      const style = getComputedStyle(element);
      if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
        const canMoveUp = delta < 0 && element.scrollTop > 0;
        const canMoveDown = delta > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1;
        if (canMoveUp || canMoveDown) return true;
      }
      element = element.parentElement;
    }
    return false;
  };

  const restorePageScroll = () => {
    root.classList.remove('is-weighted-scrolling');
    root.style.scrollBehavior = previousScrollBehavior;
    root.style.scrollSnapType = previousScrollSnapType;
  };

  const stop = () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    current = scrollY;
    target = scrollY;
    restorePageScroll();
  };

  const tick = () => {
    const distance = target - current;
    // Short, controlled tail: enough weight to remove wheel stepping without
    // leaving the page floating after the input has stopped.
    current += distance * .20;
    scrollTo(0, current);

    if (Math.abs(distance) > .35) {
      scrollFrame = requestAnimationFrame(tick);
      return;
    }

    scrollTo(0, target);
    current = target;
    scrollFrame = null;
    requestAnimationFrame(restorePageScroll);
  };

  const begin = () => {
    if (scrollFrame) return;
    current = scrollY;
    previousScrollBehavior = root.style.scrollBehavior;
    previousScrollSnapType = root.style.scrollSnapType;
    root.style.scrollBehavior = 'auto';
    root.style.scrollSnapType = 'none';
    root.classList.add('is-weighted-scrolling');
    getComputedStyle(root).scrollSnapType;
    scrollFrame = requestAnimationFrame(tick);
  };

  addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey || document.body.classList.contains('menu-open') || document.body.classList.contains('dialog-open')) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.35) return;

    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 18
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? innerHeight
        : 1;
    const delta = event.deltaY * unit;
    if (!delta || canNestedElementScroll(event.target, delta)) return;

    // High-resolution trackpads already supply their own smooth, inertial
    // stream. Leaving those native avoids a second easing curve fighting it.
    if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL && Math.abs(event.deltaY) < 40) {
      stop();
      return;
    }

    event.preventDefault();
    if (!scrollFrame) target = scrollY;
    if (Math.sign(delta) !== Math.sign(target - current) && Math.abs(target - current) > 16) {
      target = current;
    }
    const step = Math.max(-320, Math.min(320, delta * .58));
    target = clampTarget(target + step);
    target = Math.max(current - innerHeight * .82, Math.min(current + innerHeight * .82, target));
    begin();
  }, { passive: false });

  addEventListener('pointerdown', stop, { passive: true });
  addEventListener('touchstart', stop, { passive: true });
  addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stop();
  }, { passive: true });
  addEventListener('resize', () => {
    target = clampTarget(target);
    if (!scrollFrame) current = target = scrollY;
  }, { passive: true });
  addEventListener('scroll', () => {
    if (!scrollFrame) current = target = scrollY;
  }, { passive: true });
}

function installMenu() {
  const toggle = $('#menuToggle');
  const menu = $('#mobileMenu');

  const close = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  });
  $$('a', menu).forEach((link) => link.addEventListener('click', close));
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

function installExperimentDialog() {
  const dialog = $('#playDialog');
  const stage = $('#playStage');
  const title = $('#playTitle');
  const external = $('#playExternal');

  const close = () => {
    if (dialog.open) dialog.close();
  };

  $$('[data-launch]').forEach((launcher) => {
    const open = () => {
      const source = launcher.dataset.launch;
      const experimentTitle = launcher.dataset.title;
      title.textContent = experimentTitle;
      external.href = source;
      stage.replaceChildren();
      const frame = document.createElement('iframe');
      frame.src = source;
      frame.title = experimentTitle;
      frame.allow = 'camera; fullscreen';
      stage.append(frame);
      dialog.showModal();
      document.body.classList.add('dialog-open');
    };
    launcher.addEventListener('click', open);
    launcher.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  });

  $('#playClose').addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    stage.replaceChildren();
  });
}

function installAtmosphereToggle() {
  const button = $('#atmosphere');
  const label = $('span', button);
  button.addEventListener('click', () => {
    atmosphereOn = !atmosphereOn;
    button.setAttribute('aria-pressed', String(atmosphereOn));
    label.textContent = atmosphereOn ? 'Atmosphere on' : 'Atmosphere off';
    forest?.setWet(atmosphereOn ? 1 : 0);
    forest?.setWetLeaf(atmosphereOn ? .94 : .18);
    forest?.setFrontSpot(atmosphereOn ? .72 : .28);
    forest?.setLeafGloss(atmosphereOn ? 1.08 : .25);
    forest?.setMist(atmosphereOn ? .90 : .18);
    vgpuAtmosphere?.setEnabled(atmosphereOn);
  });
}

function installInquiryForm() {
  const form = $('#inquiryForm');
  if (!form) return;

  const destination = form.dataset.email || 'milkysbeta@gmail.com';
  const status = $('#inquiryStatus');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const replyTo = String(values.get('email') || '').trim();
    const project = String(values.get('project') || 'New project').trim();
    const message = String(values.get('message') || '').trim();
    const subject = `Project enquiry — ${project}`;
    const body = [
      `Hello Milky,`,
      '',
      `I’m ${name}.`,
      `Reply to: ${replyTo}`,
      `Project: ${project}`,
      '',
      message,
      '',
      'Sent from the MILKY website enquiry form.'
    ].join('\n');

    status.textContent = 'Opening your email app with the enquiry ready to send…';
    window.location.href = `mailto:${destination}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

function installDeviceTilt() {
  if (!window.DeviceOrientationEvent || !matchMedia('(pointer: coarse)').matches) return;

  const handle = (event) => {
    const x = (event.gamma || 0) / 90;
    const pitch = Math.abs((event.beta || 0) / 180);
    forest?.setGravity(x, -(.58 + pitch * .3));
  };

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    addEventListener('click', async function askForTilt() {
      removeEventListener('click', askForTilt);
      try {
        if (await DeviceOrientationEvent.requestPermission() === 'granted') {
          addEventListener('deviceorientation', handle, { passive: true });
        }
      } catch (_) {
        // Tilt is an enhancement; the pointer and scroll scene remain complete.
      }
    }, { once: true });
  } else {
    addEventListener('deviceorientation', handle, { passive: true });
  }
}

function startPanelPump() {
  const pump = () => {
    forest?.setPanels(panelRects());
    forest?.setAvoidance?.(avoidanceRects());
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
}

function finishLoader() {
  const loader = $('#loader');
  if (!loader || loader.dataset.started === 'true') return;
  loader.dataset.started = 'true';
  const bar = $('#loaderBar');
  const count = $('#loaderCount');
  let value = 0;
  let finished = false;

  const complete = () => {
    if (finished) return;
    finished = true;
    bar.style.width = '100%';
    count.textContent = '100';
    setTimeout(() => {
      loader.classList.add('is-done');
      $$('.hero .reveal').forEach((element) => element.classList.add('is-visible'));
    }, 160);
    setTimeout(() => loader.remove(), 1400);
  };

  const timer = setInterval(() => {
    value += Math.max(1, (100 - value) * .14);
    value = Math.min(value, 100);
    bar.style.width = `${value}%`;
    count.textContent = String(Math.floor(value)).padStart(3, '0');
    if (value >= 99.5) {
      clearInterval(timer);
      complete();
    }
  }, 35);
  setTimeout(complete, 4200);
}

async function boot() {
  $('#year').textContent = new Date().getFullYear();
  installMenu();
  installExperimentDialog();
  installAtmosphereToggle();
  installInquiryForm();
  installRevealObservers();
  installVideoPlayback();
  installWeightedScroll();
  installPointer();
  installDeviceTilt();

  addEventListener('scroll', requestScrollUpdate, { passive: true });
  addEventListener('resize', requestScrollUpdate, { passive: true });
  requestScrollUpdate();

  // Let the page reveal on a predictable clock while the heavier WebGL scene
  // finishes behind it. Slow networks should never strand visitors at 000.
  finishLoader();
  await bootForest();
  void bootVgpuAtmosphere();
  startPanelPump();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
