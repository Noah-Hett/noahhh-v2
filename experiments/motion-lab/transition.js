// Mask-rise page transition — port-ready vanilla reference.
// Port target: a TS React wrapper around Routes doing the same
// hold → mask → reveal. Mapping notes for the port:
//
//   routeOf/hashchange  → React Router location + useBlocker-style POP hold
//   makeResource        → real dynamic import() + new Image() preload
//   ScrollManager       → window scroll + body scroll-lock (demo uses inner scroll)
//   setFooter           → App hideFooter on /project/*
//   focusHeading        → ProjectLayout toTop focus pattern
//
// Timing is locked (700ms decision). Change TIMING, not magic numbers.
const reduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- timing budget (single source) -----------------------------------------
const TIMING = {
  duration: 700, // entry rise, locked
  entryDelay: 220, // hold before the lead panel starts
  settle: 30, // slack after the chase panel lands
  chaseLag: 160, // grey lead vs bg-chase offset (60ms + 220ms delays)
  exitMult: 1.25, // exit runs slower than entry so the reveal lingers
  exit2Ratio: 0.7, // grey lead exits faster than the bg panel
  returning: 300, // abort unwind back down
  loadbarGrace: 600, // hairline only appears if the covered wait passes this
};

// --- loading stand-ins (DEV-ONLY) ------------------------------------------
// chunk/img stand in for the port's dynamic import() + Image preload.
// ?slow restores slow-3G timings to exercise the stall fallback.
// ?fail makes the chunk reject, to exercise the abort path.
// Neither flag ships: the port replaces makeResource with real promises
// and keeps the grace/abort logic below unchanged.
const qs = new URLSearchParams(location.search);
const DEBUG = { slow: qs.has('slow'), fail: qs.has('fail') };
const DELAYS = DEBUG.slow ? { chunk: 1200, img: 1700 } : { chunk: 150, img: 250 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeResource(key) {
  return {
    state: 'cold', // cold | loading | ready
    promise: null,
    ensure() {
      if (this.promise) return this.promise;
      this.state = 'loading';
      this.promise = wait(DELAYS[key]).then(() => {
        if (DEBUG.fail && key === 'chunk') throw new Error('chunk failed (?fail)');
        this.state = 'ready';
      });
      return this.promise;
    },
  };
}
const chunk = makeResource('chunk');
const img = makeResource('img');

const stage = document.getElementById('t-stage');
const mask = document.getElementById('t-mask');
const mask2 = document.getElementById('t-mask2');
const loadbar = document.getElementById('t-loadbar');
const footer = document.getElementById('t-fakefooter');
const status = document.getElementById('t-status');
let current = 'home';

// --- pages -----------------------------------------------------------------
const page = (name) => stage.querySelector(`[data-page="${name}"]`);
const routeOf = () => (location.hash === '#/project' ? 'project' : 'home');

function setNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-nav') === name);
  });
}

function assemble(p) {
  p.classList.add('in');
  p.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
}

function disassemble(p) {
  p.classList.remove('in');
  p.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
}

function setFooter(name) {
  // Home-only footer (mirrors the port's hideFooter). Called at init and at
  // the swap — always under full cover, so it never flashes.
  if (footer) footer.hidden = name !== 'home';
}

function focusHeading(p) {
  // Land focus on the incoming heading so keyboard/SR users don't lose
  // context (mirrors ProjectLayout's toTop pattern, minus the scroll).
  const h = p.querySelector('h1, h2');
  if (!(h instanceof HTMLElement)) return;
  const prev = h.getAttribute('tabindex');
  h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
  if (prev === null) h.removeAttribute('tabindex');
  else h.setAttribute('tabindex', prev);
}

function say(msg) {
  if (status) status.textContent = msg;
}

// First paint: show the routed page, assembled, no theatre.
function init() {
  current = routeOf();
  const p = page(current);
  p.classList.add('active');
  p.scrollTop = 0;
  assemble(p);
  if (current === 'project') {
    chunk.state = 'ready';
    img.state = 'ready';
  }
  setNav(current);
  setFooter(current);
}

// Serialized so rapid clicks / back-button mid-load queue instead of
// overlapping: only one hold → mask → reveal runs at a time.
let chain = Promise.resolve();

async function go(name) {
  if (name === current || !stage || !mask || !mask2) return;
  const out = page(current);
  const inn = page(name);

  if (reduced()) {
    out.classList.remove('active', 'leaving');
    disassemble(out);
    inn.classList.add('active');
    inn.scrollTop = 0;
    assemble(inn);
    focusHeading(inn);
    current = name;
    setNav(name);
    setFooter(name);
    return;
  }

  await animatingHold(out, inn, name);
}

async function animatingHold(out, inn, name) {
  stage.style.setProperty('--t-d', `${TIMING.duration}ms`);
  inn.classList.add('active');
  inn.scrollTop = 0;
  disassemble(inn);
  // The mask IS the incoming bg from the start — set instantly (no
  // transition on the base). Port: replace with the incoming route's bg token.
  const target = getComputedStyle(inn).backgroundColor;
  mask.style.transition = 'none';
  mask.style.background = target;
  mask.classList.remove('rising', 'exit');
  mask2.classList.remove('rising', 'exit');
  void mask.offsetWidth;
  mask.style.transition = '';

  const needsAssets = name === 'project' && (chunk.state !== 'ready' || img.state !== 'ready');
  // Stall fallback: the hairline only appears if the covered wait passes
  // the grace period — fast loads never show it.
  let grace = 0;
  if (needsAssets && loadbar) {
    grace = window.setTimeout(() => loadbar.classList.add('loading'), TIMING.loadbarGrace);
  }
  const assetsP = needsAssets
    ? Promise.all([chunk.ensure(), img.ensure()])
    : Promise.resolve();

  // Double-rAF so the class add can't batch with the style flush above
  // and skip the transition.
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        out.classList.add('leaving');
        mask.classList.add('rising');
        mask2.classList.add('rising');
        resolve();
      });
    });
  });
  // Reveal at the later of chase-landed / assets-ready. The chase panel
  // lands entryDelay + duration after the lead starts; the lead started
  // entryDelay − chaseLag... wait for the chase.
  let assetsOk = true;
  try {
    await Promise.all([wait(TIMING.entryDelay + TIMING.duration + TIMING.settle), assetsP]);
  } catch {
    assetsOk = false;
  }
  window.clearTimeout(grace);
  if (loadbar) loadbar.classList.remove('loading');
  if (!assetsOk) {
    // Abort: the swap never happened (outgoing still on top), so unwind the
    // panels back down, reset for retry, and revert the hash so route and
    // page agree again. The hash revert no-ops in the hashchange handler
    // (route already equals current), so no second transition runs.
    chunk.promise = null;
    chunk.state = 'cold';
    img.promise = null;
    img.state = 'cold';
    out.classList.remove('leaving');
    mask.classList.remove('rising');
    mask.classList.add('returning');
    mask2.classList.remove('rising');
    mask2.classList.add('returning');
    say('Chunk failed — staying put. Click to retry.');
    await wait(TIMING.returning + 40);
    mask.classList.remove('returning');
    mask2.classList.remove('returning');
    location.hash = current === 'home' ? '#/' : '#/project';
    return;
  }
  out.classList.remove('active', 'leaving');
  disassemble(out);
  assemble(inn);
  focusHeading(inn);
  setFooter(name);
  // Exit runs slower than entry so the reveal lingers.
  const exitDur = Math.round(TIMING.duration * TIMING.exitMult);
  stage.style.setProperty('--t-exit', `${exitDur}ms`);
  stage.style.setProperty('--t-exit2', `${Math.round(exitDur * TIMING.exit2Ratio)}ms`);
  mask.classList.remove('rising');
  mask.classList.add('exit');
  mask2.classList.remove('rising');
  mask2.classList.add('exit');
  await wait(exitDur + 40);
  mask.classList.remove('exit');
  mask2.classList.remove('exit');
  current = name;
  setNav(name);
}

window.addEventListener('hashchange', () => {
  // Collapse stale intermediates: only the latest route runs. Rapid
  // home→project→home executes a single transition to the final route.
  chain = chain.then(() => {
    const n = routeOf();
    if (n !== current) return go(n);
  });
});

// Intent prefetch: hovering or keyboard-focusing any project link warms the
// chunk + image, exactly like the port will on pointerenter. Rejections are
// swallowed here — a failed prefetch just means the real navigation attempt
// handles the error via the abort path.
document.querySelectorAll('a[href="#/project"]').forEach((a) => {
  const prefetch = () => {
    if (current !== 'home') return;
    chunk.ensure().catch(() => {});
    img.ensure().catch(() => {});
  };
  a.addEventListener('pointerenter', prefetch);
  a.addEventListener('focus', prefetch);
});

init();
