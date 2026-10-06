// Motion lab interactions. Vanilla JS, no build step — open index.html directly.
// Every prototype respects prefers-reduced-motion (static end-state, no flight).
const reduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Fake DotGrid: cheap static dots so the entry stage reads like the hero.
function paintDots() {
  document.querySelectorAll('.fake-dots').forEach((c) => {
    const w = (c.width = c.clientWidth || 600);
    const h = (c.height = c.clientHeight || 300);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#a3a3a3';
    for (let x = 24; x < w; x += 48) {
      for (let y = 24; y < h; y += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// 01 entry: staged assembly — dots, then copy/art/photo masks.
function playEntry() {
  const stage = document.getElementById('entry-stage');
  if (!stage) return;
  stage.classList.remove('in');
  stage.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
  void stage.offsetWidth; // restart transitions
  requestAnimationFrame(() => {
    stage.classList.add('in');
    stage.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
  });
}

// 02 mask-rise: panel (incoming bg) rises from bottom, becomes the page.
function playMask() {
  const stage = document.getElementById('mask-stage');
  if (!stage) return;
  const out = stage.querySelector('.page-out');
  const incoming = stage.querySelector('.page-in');
  if (!out || !incoming) return;
  out.classList.remove('leaving');
  incoming.classList.remove('rising', 'in');
  incoming.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
  void stage.offsetWidth;
  if (reduced()) {
    out.style.display = 'none';
    incoming.style.clipPath = 'inset(0 0 0 0)';
    incoming.classList.add('in');
    incoming.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
    setTimeout(() => { out.style.display = ''; }, 2500);
    return;
  }
  requestAnimationFrame(() => {
    out.classList.add('leaving');
    incoming.classList.add('rising');
    // content assembles just after the panel covers
    setTimeout(() => {
      incoming.classList.add('in');
      incoming.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
    }, 450);
  });
}

// 03/04 morph: FLIP flight of a clone from card rect to target rect.
function playMorph(stageId, sourceId, targetId) {
  const stage = document.getElementById(stageId);
  const source = document.getElementById(sourceId);
  const target = document.getElementById(targetId);
  if (!stage || !source || !target) return;
  document.querySelectorAll('.m-fly').forEach((el) => el.remove());
  const project = stage.querySelector('.m-project');
  if (project) project.classList.add('dim');

  const s = source.getBoundingClientRect();
  const t = target.getBoundingClientRect();

  if (reduced()) {
    if (project) project.classList.remove('dim');
    target.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 200 });
    return;
  }

  const fly = document.createElement('div');
  fly.className = 'm-fly';
  fly.textContent = source.textContent;
  Object.assign(fly.style, {
    left: `${s.left}px`, top: `${s.top}px`,
    width: `${s.width}px`, height: `${s.height}px`,
  });
  document.body.appendChild(fly);

  // outgoing card fades as the clone takes over; incoming side stays dim
  source.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 350, easing: 'ease-out', fill: 'forwards' });

  const flight = fly.animate(
    [
      { transform: 'translate(0, 0) scale(1, 1)', borderRadius: '0px' },
      {
        transform: `translate(${t.left - s.left}px, ${t.top - s.top}px) scale(${t.width / s.width}, ${t.height / s.height})`,
        borderRadius: '0px',
      },
    ],
    { duration: 750, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  );
  flight.onfinish = () => {
    if (project) project.classList.remove('dim');
    target.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 250, easing: 'ease-out' },
    );
    fly.remove();
    source.getAnimations().forEach((a) => a.cancel());
  };
}

// 05 loading: skeleton only when slow (>600ms); blur-up for media.
let loadTimer = 0;
function playLoading(slow) {
  const stage = document.getElementById('loading-stage');
  if (!stage) return;
  const real = stage.querySelector('.load-real');
  const sk = stage.querySelector('.load-sk');
  const note = stage.querySelector('.load-note');
  const blurbox = stage.querySelector('[data-blur]');
  if (!real || !sk || !note || !blurbox) return;
  window.clearTimeout(loadTimer);
  real.hidden = true;
  sk.hidden = true;
  note.hidden = false;
  blurbox.classList.remove('sharp');
  real.classList.remove('in');
  real.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));

  const showReal = () => {
    sk.hidden = true;
    note.hidden = true;
    real.hidden = false;
    void real.offsetWidth;
    real.classList.add('in');
    real.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
    // media sharpens slightly after the copy starts
    setTimeout(() => blurbox.classList.add('sharp'), reduced() ? 0 : 350);
  };

  if (!slow) {
    note.textContent = 'fast load — straight to assembly, no skeleton';
    loadTimer = window.setTimeout(showReal, reduced() ? 0 : 250);
    return;
  }
  // slow: skeleton appears only after the 600ms grace period
  note.textContent = 'fetching… (skeleton appears after 600ms grace)';
  loadTimer = window.setTimeout(() => {
    sk.hidden = false;
    note.textContent = 'stalled — skeleton fallback in page shape';
    loadTimer = window.setTimeout(showReal, 1400);
  }, 600);
}

document.querySelectorAll('[data-replay]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const kind = btn.getAttribute('data-replay');
    if (kind === 'entry') playEntry();
    else if (kind === 'mask') playMask();
    else if (kind === 'morph-a') playMorph('morph-a-stage', 'morph-a-source', 'morph-a-target');
    else if (kind === 'morph-b') playMorph('morph-b-stage', 'morph-b-source', 'morph-b-target');
    else if (kind === 'loading-fast') playLoading(false);
    else if (kind === 'loading-slow') playLoading(true);
  });
});

const maskStage = document.getElementById('mask-stage');
if (maskStage) {
  maskStage.addEventListener('click', playMask);
  maskStage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playMask();
    }
  });
}

window.addEventListener('load', () => {
  paintDots();
  playEntry();
});
window.addEventListener('resize', paintDots);
