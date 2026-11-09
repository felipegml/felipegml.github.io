(() => {
  const canvas = document.getElementById('grid');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const bctx = bg.getContext('2d');

  const LINE_COLOR = '#252525';
  const LINE_ALPHA = 0.08;
  const NODE_ALPHA = 0.18;
  const PULSE_ALPHA = 0.5;
  const PULSE_SPEED = 190;
  const PULSE_TRAIL = 90;
  const SEEK_BIAS = 0.9;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  let w = 0, h = 0, dpr = 1, cell = 36;
  let mx = 0, my = 0, hover = false;
  let pulses = [];
  let last = 0;

  const nodePos = (i) => Math.round(i * cell) + 0.5;

  function drawBackground() {
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, w, h);
    bctx.strokeStyle = LINE_COLOR;
    bctx.fillStyle = LINE_COLOR;
    bctx.lineWidth = 1;
    bctx.globalAlpha = LINE_ALPHA;
    bctx.beginPath();
    const cols = Math.ceil(w / cell) + 1;
    const rows = Math.ceil(h / cell) + 1;
    for (let i = 0; i < cols; i++) {
      bctx.moveTo(nodePos(i), 0); bctx.lineTo(nodePos(i), h);
    }
    for (let j = 0; j < rows; j++) {
      bctx.moveTo(0, nodePos(j)); bctx.lineTo(w, nodePos(j));
    }
    bctx.stroke();
    bctx.globalAlpha = NODE_ALPHA;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        bctx.fillRect(nodePos(i) - 1, nodePos(j) - 1, 2, 2);
      }
    }
  }

  function inBounds(i, j) {
    return i >= 0 && j >= 0 && nodePos(i) <= w + cell && nodePos(j) <= h + cell;
  }

  function spawn(p) {
    const cols = Math.floor(w / cell), rows = Math.floor(h / cell);
    p.i = Math.floor(Math.random() * (cols + 1));
    p.j = Math.floor(Math.random() * (rows + 1));
    p.d = Math.floor(Math.random() * 4);
    p.hops = 8 + Math.floor(Math.random() * 20);
    p.speed = PULSE_SPEED * (0.7 + Math.random() * 0.6);
    p.len = 0;
    p.ending = false;
    p.x = nodePos(p.i); p.y = nodePos(p.j);
    p.trail = [p.x, p.y, p.x, p.y];
    pickNext(p, true);
  }

  // Choose the next direction at a node: toward the pointer if hovering, otherwise random.
  function pickNext(p, first) {
    let d = p.d;
    if (hover) {
      const dx = mx - p.x, dy = my - p.y;
      if (Math.abs(dx) < cell * 0.6 && Math.abs(dy) < cell * 0.6) {
        p.ending = true;
        return;
      }
      if (Math.random() < SEEK_BIAS) {
        const horizontal = Math.random() * (Math.abs(dx) + Math.abs(dy)) < Math.abs(dx);
        const want = horizontal ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
        const dir = DIRS[want];
        if (inBounds(p.i + dir[0], p.j + dir[1])) { setDir(p, want); return; }
      }
    }
    if (!first && Math.random() < 0.3) d = (d + (Math.random() < 0.5 ? 1 : 3)) % 4;
    for (let n = 0; n < 4; n++) {
      const cand = (d + n) % 4;
      const dir = DIRS[cand];
      if (!first && cand === (p.d + 2) % 4) continue;
      if (inBounds(p.i + dir[0], p.j + dir[1])) { setDir(p, cand); return; }
    }
    setDir(p, (p.d + 2) % 4);
  }

  function setDir(p, d) {
    if (d !== p.d) p.trail.splice(p.trail.length - 2, 2, p.x, p.y, p.x, p.y);
    p.d = d;
  }

  function initPulses() {
    const count = Math.max(16, Math.round((w * h) / (cell * cell) / 28));
    pulses = [];
    for (let k = 0; k < count; k++) {
      const p = {};
      spawn(p);
      p.hops = Math.floor(Math.random() * p.hops) + 1;
      pulses.push(p);
    }
  }

  function trimTrail(p) {
    const t = p.trail;
    let total = 0;
    for (let k = t.length - 2; k >= 2; k -= 2) {
      total += Math.abs(t[k] - t[k - 2]) + Math.abs(t[k + 1] - t[k - 1]);
    }
    let excess = total - p.len;
    while (excess > 0 && t.length > 4) {
      const seg = Math.abs(t[2] - t[0]) + Math.abs(t[3] - t[1]);
      if (seg <= excess) { t.splice(0, 2); excess -= seg; continue; }
      const r = excess / seg;
      t[0] += (t[2] - t[0]) * r;
      t[1] += (t[3] - t[1]) * r;
      break;
    }
  }

  function updatePulses(dt) {
    for (const p of pulses) {
      let move = p.speed * dt;
      if (p.ending) {
        p.len -= move;
        if (p.len <= 0) spawn(p); else trimTrail(p);
        continue;
      }
      p.len = Math.min(PULSE_TRAIL, p.len + move);
      while (move > 0 && !p.ending) {
        const dir = DIRS[p.d];
        const nx = nodePos(p.i + dir[0]), ny = nodePos(p.j + dir[1]);
        const dist = Math.abs(nx - p.x) + Math.abs(ny - p.y);
        if (move < dist) {
          p.x += dir[0] * move; p.y += dir[1] * move;
          move = 0;
        } else {
          p.x = nx; p.y = ny; p.i += dir[0]; p.j += dir[1];
          move -= dist;
          if (--p.hops <= 0) p.ending = true;
          else pickNext(p, false);
        }
      }
      const t = p.trail;
      t[t.length - 2] = p.x; t[t.length - 1] = p.y;
      trimTrail(p);
    }
  }

  function drawPulses() {
    ctx.strokeStyle = LINE_COLOR;
    ctx.fillStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    const STEP = 6;
    for (const p of pulses) {
      const t = p.trail;
      let dist = 0;
      for (let k = t.length - 2; k >= 2; k -= 2) {
        const ax = t[k], ay = t[k + 1], bx = t[k - 2], by = t[k - 1];
        const segLen = Math.abs(bx - ax) + Math.abs(by - ay);
        if (segLen === 0) continue;
        const ux = (bx - ax) / segLen, uy = (by - ay) / segLen;
        for (let s = 0; s < segLen; s += STEP) {
          const e = Math.min(s + STEP, segLen);
          const fade = Math.max(0, 1 - (dist + s) / PULSE_TRAIL);
          ctx.globalAlpha = PULSE_ALPHA * fade * fade;
          ctx.beginPath();
          ctx.moveTo(ax + ux * s, ay + uy * s);
          ctx.lineTo(ax + ux * e, ay + uy * e);
          ctx.stroke();
        }
        dist += segLen;
      }
      if (!p.ending) {
        ctx.globalAlpha = 0.8;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPulses();
  }

  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
    last = t;
    updatePulses(dt);
    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = bg.width = Math.round(w * dpr);
    canvas.height = bg.height = Math.round(h * dpr);
    cell = w < 600 ? 32 : w > 1600 ? 42 : 36;
    drawBackground();
    initPulses();
    render();
  }

  function track(x, y) { mx = x; my = y; hover = true; }
  function release() { hover = false; }

  window.addEventListener('pointermove', (e) => track(e.clientX, e.clientY), { passive: true });
  document.documentElement.addEventListener('mouseleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('touchstart', (e) => track(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  window.addEventListener('touchmove', (e) => track(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  window.addEventListener('touchend', release);
  window.addEventListener('touchcancel', release);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 60);
  });

  resize();
  if (!reduceMotion) requestAnimationFrame(frame);
})();
