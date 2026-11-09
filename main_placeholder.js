(() => {
  const canvas = document.getElementById('grid');
  const ctx = canvas.getContext('2d');

  const LINE_COLOR = '#252525';
  const BASE_ALPHA = 0.035;
  const PEAK_ALPHA = 0.5;
  const SEG = 10;
  const POS_EASE = 0.14;
  const FADE_EASE = 0.08;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1, cell = 36, radius = 260;
  let tx = 0, ty = 0, x = 0, y = 0;
  let target = 0, level = 0;
  let touching = false;
  let running = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = w < 600 ? 32 : w > 1600 ? 42 : 36;
    radius = Math.max(150, Math.min(300, Math.min(w, h) * 0.32));
    if (!x && !y) { x = tx = w / 2; y = ty = h / 2; }
    start();
  }

  function falloff(d) {
    if (d >= radius) return 0;
    const t = 1 - d / radius;
    return t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
  }

  function alphaAt(px, py) {
    const dx = px - x, dy = py - y;
    const f = falloff(Math.sqrt(dx * dx + dy * dy)) * level;
    return BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * f;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';

    const r2 = radius * radius;
    const cols = Math.ceil(w / cell) + 1;
    const rows = Math.ceil(h / cell) + 1;
    const active = level > 0.002;

    ctx.globalAlpha = BASE_ALPHA;
    ctx.beginPath();

    const revealed = [];

    // Vertical lines
    for (let i = 0; i < cols; i++) {
      const px = Math.round(i * cell) + 0.5;
      const near = active && Math.abs(px - x) < radius;
      if (!near) { ctx.moveTo(px, 0); ctx.lineTo(px, h); continue; }
      for (let py = 0; py < h; py += SEG) {
        const my = py + SEG / 2, dx = px - x, dy = my - y;
        if (dx * dx + dy * dy >= r2) {
          ctx.moveTo(px, py); ctx.lineTo(px, Math.min(py + SEG, h));
        } else {
          revealed.push(px, py, px, Math.min(py + SEG, h), alphaAt(px, my));
        }
      }
    }

    // Horizontal lines
    for (let j = 0; j < rows; j++) {
      const py = Math.round(j * cell) + 0.5;
      const near = active && Math.abs(py - y) < radius;
      if (!near) { ctx.moveTo(0, py); ctx.lineTo(w, py); continue; }
      for (let px = 0; px < w; px += SEG) {
        const mx = px + SEG / 2, dx = mx - x, dy = py - y;
        if (dx * dx + dy * dy >= r2) {
          ctx.moveTo(px, py); ctx.lineTo(Math.min(px + SEG, w), py);
        } else {
          revealed.push(px, py, Math.min(px + SEG, w), py, alphaAt(mx, py));
        }
      }
    }
    ctx.stroke();

    for (let k = 0; k < revealed.length; k += 5) {
      ctx.globalAlpha = revealed[k + 4];
      ctx.beginPath();
      ctx.moveTo(revealed[k], revealed[k + 1]);
      ctx.lineTo(revealed[k + 2], revealed[k + 3]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function autonomousTarget(t) {
    tx = w * (0.5 + 0.32 * Math.sin(t * 0.00023));
    ty = h * (0.5 + 0.32 * Math.sin(t * 0.00031 + 1.3));
  }

  function frame(t) {
    if (coarse && !touching && !reduceMotion) {
      autonomousTarget(t);
      target = 0.8;
    }
    x += (tx - x) * POS_EASE;
    y += (ty - y) * POS_EASE;
    level += (target - level) * FADE_EASE;

    draw();

    const settled = Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1 &&
      Math.abs(target - level) < 0.002;
    if (settled && !(coarse && !reduceMotion)) {
      level = target;
      running = false;
      draw();
      return;
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function move(px, py) {
    tx = px; ty = py;
    if (target === 0 && level < 0.01) { x = px; y = py; }
    target = 1;
    start();
  }

  function leave() {
    target = 0;
    start();
  }

  if (!coarse) {
    window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    window.addEventListener('blur', leave);
  }

  window.addEventListener('touchstart', (e) => {
    touching = true;
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  const endTouch = () => { touching = false; leave(); };
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 60);
  });

  resize();
})();
