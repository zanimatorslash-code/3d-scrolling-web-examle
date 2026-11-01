/* =========================================================
   Sony WH-1000XM6 — scroll sequence, reveals, live toggle
   ========================================================= */

(() => {
  const TOTAL_FRAMES = 300;
  const LOOKAHEAD = 24;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const frameSrc = (i) => `frame 2/ezgif-frame-${String(i).padStart(3, '0')}.png`;

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('sequence');
  const ctx = canvas.getContext('2d');
  const progressEl = document.getElementById('progress');
  const header = document.getElementById('siteHeader');

  /* ---------- Frame loading ---------- */

  // index -> HTMLImageElement | 'loading' | 'failed'
  const frames = new Map();
  let current = 1;
  let displayProgress = 0;
  let looping = false;

  function ensureFrame(i) {
    if (i < 1 || i > TOTAL_FRAMES || frames.has(i)) return;
    frames.set(i, 'loading');
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      frames.set(i, img);
      if (i === current) draw();
    };
    img.onerror = () => {
      frames.set(i, 'failed');
      // If the very first frame is missing, the sequence is not set up yet.
      if (i === 1) stage.classList.add('no-frames');
    };
    img.src = frameSrc(i);
  }

  function preloadAround(i) {
    for (let k = 0; k <= LOOKAHEAD; k++) ensureFrame(i + k);
  }

  // Walk back to the nearest frame that has loaded.
  function getFrame(i) {
    for (let step = 0; step < 30; step++) {
      const f = frames.get(i - step);
      if (f && f.complete && f.naturalWidth > 0) return f;
    }
    return null;
  }

  // Gently fill in the rest of the sequence after the page has settled.
  let bg = 1;
  function backgroundLoad() {
    if (frames.get(1) === 'failed') return;
    // Load faster with shorter interval for smoother playback
    for (let k = bg; k < bg + 30 && k <= TOTAL_FRAMES; k++) ensureFrame(k);
    bg += 30;
    if (bg <= TOTAL_FRAMES) setTimeout(backgroundLoad, 15); // very fast preload
  }

  /* ---------- Drawing ---------- */

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    sizeAnc();
    drawAnc();
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    const img = getFrame(current);
    if (!img) return;

    // Full-bleed background: image fills the entire viewport (cover style)
    const scaleFactor = 0.88; // slightly reduced for premium breathing room
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * scaleFactor;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const cx = (w - dw) / 2;
    const cy = (h - dh) / 2;
    ctx.drawImage(img, cx, cy, dw, dh);
  }

  /* ---------- Scroll → frame ---------- */

  function getProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function kick() {
    if (!looping) {
      looping = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    const target = getProgress();
    displayProgress += (target - displayProgress) * (reduceMotion ? 1 : 0.10); // smoother, butter-like tracking
    const settled = Math.abs(target - displayProgress) < 0.0005;
    if (settled) displayProgress = target;

    progressEl.style.width = target * 100 + '%';
    header.classList.toggle('scrolled', window.scrollY > 80);

    const frame = Math.round(displayProgress * (TOTAL_FRAMES - 1)) + 1;
    if (frame !== current) {
      current = frame;
      preloadAround(current);
      draw();
    }

    // 3D scroll-linked rotation: smoother, more subtle depth effect
    const rotateY = (displayProgress - 0.5) * 10; // gentler rotation
    const rotateX = displayProgress * -5; // very subtle tilt
    const scale = 1 - (displayProgress * 0.025); // minimal zoom for smoothness
    stage.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale})`;

    requestAnimationFrame(tick); // always loop for instant, smooth response
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', () => {
    resize();
    kick();
  });

  /* ---------- Scene reveals ---------- */

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('in');
      });
    },
    { threshold: 0.25 }
  );
  document.querySelectorAll('.scene').forEach((scene) => reveal.observe(scene));

  /* ---------- Noise-cancelling illustration (illustrative, not measured) ---------- */

  const ancCanvas = document.getElementById('ancViz');
  const actx = ancCanvas.getContext('2d');
  const toggle = document.getElementById('ancToggle');
  const toggleState = document.getElementById('ancState');

  let ancOn = true;
  let amp = 0.08;
  let t = 0;
  let ancVisible = false;
  let animId = null;

  function sizeAnc() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancCanvas.width = Math.round(ancCanvas.clientWidth * dpr);
    ancCanvas.height = Math.round(ancCanvas.clientHeight * dpr);
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawAnc() {
    const w = ancCanvas.clientWidth;
    const h = ancCanvas.clientHeight;
    if (!w || !h) return;

    const target = ancOn ? 0.08 : 1;
    amp += (target - amp) * (reduceMotion ? 1 : 0.08);

    actx.clearRect(0, 0, w, h);

    // Baseline
    actx.strokeStyle = 'rgba(243,242,239,0.12)';
    actx.lineWidth = 1;
    actx.beginPath();
    actx.moveTo(0, h / 2);
    actx.lineTo(w, h / 2);
    actx.stroke();

    // Noise waveform: large and grey when off, flat and cyan when on
    actx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const p = x / w;
      const noise =
        Math.sin(p * 97 + t * 1.7) * 0.5 +
        Math.sin(p * 41 - t * 2.3) * 0.35 +
        Math.sin(p * 173 + t * 3.1) * 0.15;
      const y = h / 2 + noise * amp * h * 0.38;
      if (x === 0) actx.moveTo(x, y);
      else actx.lineTo(x, y);
    }
    actx.strokeStyle = ancOn ? '#7FE3FF' : 'rgba(243,242,239,0.55)';
    actx.lineWidth = 2;
    actx.stroke();

    if (!reduceMotion) t += 0.04;
  }

  function ancFrame() {
    drawAnc();
    animId = ancVisible && !reduceMotion ? requestAnimationFrame(ancFrame) : null;
  }

  function startAnc() {
    if (animId || !ancVisible || reduceMotion) return;
    animId = requestAnimationFrame(ancFrame);
  }

  const ancObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        ancVisible = entry.isIntersecting;
        if (ancVisible) startAnc();
      });
    },
    { threshold: 0.1 }
  );
  ancObserver.observe(ancCanvas);

  toggle.addEventListener('click', () => {
    ancOn = !ancOn;
    toggle.setAttribute('aria-pressed', String(ancOn));
    toggleState.textContent = ancOn ? 'On' : 'Off';
    if (reduceMotion) drawAnc();
    startAnc();
  });

  /* ---------- Start ---------- */

  window.addEventListener('load', () => {
    resize();
    preloadAround(1);
    setTimeout(backgroundLoad, 400);
    kick();
  });
})();
