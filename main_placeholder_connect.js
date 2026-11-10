(() => {
  'use strict';

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const VIOLET = '139,92,246';
  const CYAN = '0,229,255';
  const PALE = '225,250,255';
  const MAGENTA = '255,45,149';

  let w = 0, h = 0, dpr = 1, rafId = 0, last = 0, time = 0;
  let nodes = [];
  let base = 110;       // base connection distance
  let isTouch = false;
  const edges = new Map();
  const pulses = [];
  let adj = [];

  const ripples = [];
  const par = { x: 0, y: 0, swirl: 0 };
  let lastRipple = { x: -9999, y: -9999 };

  function addRipple(x, y, strength) {
    if (ripples.length < 6) ripples.push({ x, y, r: 0, s: strength });
  }

  const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, alive: 0, active: false, boost: 0 };

  function gauss() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  function makeNode(x, y, hub) {
    const r = hub ? 2.6 + Math.random() * 1.0 : 1.1 + Math.random() * 0.9;
    return {
      hx: x, hy: y, x, y, ox: 0, oy: 0,
      ax: 6 + Math.random() * 16, ay: 6 + Math.random() * 16,
      sx: 0.04 + Math.random() * 0.09, sy: 0.04 + Math.random() * 0.09,
      px: Math.random() * 6.283, py: Math.random() * 6.283,
      r, hub, op: 0.55 + Math.random() * 0.45,
      raw: 0, act: 0, flash: 0, tint: Math.random() < 0.08, cell: 0,
      depth: hub ? 1.2 : 0.3 + Math.random() * 0.8
    };
  }

  function triangulate(points) {
    if (points.length < 3) return [];
    const coords = points.map(({ x, y }) => ({ x, y }));
    const span = Math.max(w, h);
    const centerX = w / 2, centerY = h / 2;
    const firstSuper = points.length;
    coords.push(
      { x: centerX - span * 20, y: centerY - span * 10 },
      { x: centerX, y: centerY + span * 20 },
      { x: centerX + span * 20, y: centerY - span * 10 }
    );

    let triangles = [makeTriangle(firstSuper, firstSuper + 1, firstSuper + 2, coords)];
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const boundary = new Map();
      const remaining = [];
      for (const triangle of triangles) {
        if (containsInCircumcircle(triangle, coords[pointIndex], coords)) {
          for (let edge = 0; edge < 3; edge++) {
            const a = triangle[edge], b = triangle[(edge + 1) % 3];
            const key = a < b ? a + ':' + b : b + ':' + a;
            const entry = boundary.get(key);
            if (entry) entry.count++;
            else boundary.set(key, { a, b, count: 1 });
          }
        } else {
          remaining.push(triangle);
        }
      }
      for (const edge of boundary.values()) {
        if (edge.count === 1) remaining.push(makeTriangle(edge.a, edge.b, pointIndex, coords));
      }
      triangles = remaining;
    }

    return triangles.filter(([a, b, c]) => a < firstSuper && b < firstSuper && c < firstSuper);
  }

  function makeTriangle(a, b, c, points) {
    const pa = points[a], pb = points[b], pc = points[c];
    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
    return area >= 0 ? [a, b, c] : [a, c, b];
  }

  function containsInCircumcircle(triangle, point, points) {
    const a = points[triangle[0]], b = points[triangle[1]], c = points[triangle[2]];
    const ax = a.x - point.x, ay = a.y - point.y;
    const bx = b.x - point.x, by = b.y - point.y;
    const cx = c.x - point.x, cy = c.y - point.y;
    const determinant = (ax * ax + ay * ay) * (bx * cy - cx * by)
      - (bx * bx + by * by) * (ax * cy - cx * ay)
      + (cx * cx + cy * cy) * (ax * by - bx * ay);
    return determinant > 0;
  }

  function build() {
    const area = w * h;
    const cap = isTouch || w < 700 ? 140 : 360;
    const n = Math.max(60, Math.min(cap, Math.round(area / 7000)));
    base = Math.max(65, Math.min(125, Math.min(w, h) * 0.12));
    nodes = [];
    const nc = Math.max(4, Math.round(n / 22));
    const centers = [];
    for (let i = 0; i < nc; i++) {
      const c = { x: Math.random() * w, y: Math.random() * h };
      centers.push(c);
      nodes.push(makeNode(c.x, c.y, true));
    }
    const sigma = Math.min(w, h) * 0.09;
    while (nodes.length < n) {
      let x, y;
      if (Math.random() < 0.72) {
        const c = centers[(Math.random() * nc) | 0];
        x = c.x + gauss() * sigma;
        y = c.y + gauss() * sigma;
      } else {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      x = Math.min(w + 30, Math.max(-30, x));
      y = Math.min(h + 30, Math.max(-30, y));
      nodes.push(makeNode(x, y, Math.random() < 0.035));
    }
    edges.clear();
    pulses.length = 0;
    adj = nodes.map(() => []);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    update(0, true);
    draw();
  }

  // ---- Simulation ----
  function update(dt, instant) {
    const R = (isTouch ? 130 : 175) * (1 + pointer.boost * 0.5);
    const R2 = R * R;
    const alive = pointer.alive;
    const n = nodes.length;

    // global parallax: layers shift against the cursor's offset from screen centre
    const ptx = alive > 0.003 ? (pointer.x / w - 0.5) : 0;
    const pty = alive > 0.003 ? (pointer.y / h - 0.5) : 0;
    const pk = Math.min(1, 0.04 * dt);
    par.x += (ptx - par.x) * pk;
    par.y += (pty - par.y) * pk;
    par.swirl += (alive * (0.4 + pointer.boost) - par.swirl) * Math.min(1, 0.05 * dt);

    for (let k = ripples.length - 1; k >= 0; k--) {
      const rp = ripples[k];
      rp.r += 5 * dt;
      rp.s *= Math.pow(0.985, dt);
      if (rp.s < 0.03) ripples.splice(k, 1);
    }
    const SW = isTouch ? 220 : 320;

    for (let i = 0; i < n; i++) {
      const p = nodes[i];
      p.x = p.hx + Math.sin(time * p.sx + p.px) * p.ax + p.ox - par.x * 70 * p.depth;
      p.y = p.hy + Math.cos(time * p.sy + p.py) * p.ay + p.oy - par.y * 70 * p.depth;

      let raw = 0, tox = 0, toy = 0;

      // swirl: nodes orbit the cursor with a wave-like phase, falling off with distance
      if (par.swirl > 0.004) {
        const sx = p.x - pointer.x, sy = p.y - pointer.y;
        const sd = Math.sqrt(sx * sx + sy * sy) + 0.001;
        if (sd < SW * 2.2) {
          const f = Math.exp(-(sd * sd) / (SW * SW)) * par.swirl;
          const wave = Math.sin(sd * 0.025 - time * 2.2);
          const ang = f * (0.5 + 0.35 * wave);
          tox += (-sy / sd) * sd * ang * 0.18;
          toy += (sx / sd) * sd * ang * 0.18;
        }
      }
      // ripples: expanding rings push nodes radially
      for (let k = 0; k < ripples.length; k++) {
        const rp = ripples[k];
        const rx = p.x - rp.x, ry = p.y - rp.y;
        const rd = Math.sqrt(rx * rx + ry * ry) + 0.001;
        const band = (rd - rp.r) / 45;
        if (band > -3 && band < 3) {
          const m = Math.exp(-band * band) * rp.s * 26;
          tox += (rx / rd) * m;
          toy += (ry / rd) * m;
        }
      }
      if (alive > 0.003) {
        const dx = pointer.x - p.x, dy = pointer.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 * 4) {
          const d = Math.sqrt(d2) + 0.001;
          raw = Math.exp(-d2 / R2) * alive;
          // repel up close, mild attraction at mid range
          const mag = 7 * raw * (d / R - 0.4) / 0.6 * (1 + pointer.boost);
          tox += (dx / d) * mag;
          toy += (dy / d) * mag;
        }
      }
      p.raw = raw;
      const k = Math.min(1, 0.1 * dt);
      p.ox += (tox - p.ox) * k;
      p.oy += (toy - p.oy) * k;
    }

    for (const e of edges.values()) e.target = 0;
    for (const triangle of triangulate(nodes)) {
      const pairs = [
        [triangle[0], triangle[1]],
        [triangle[1], triangle[2]],
        [triangle[2], triangle[0]]
      ];
      const links = pairs.map(([a, b]) => {
        const first = nodes[a], second = nodes[b];
        const d = Math.hypot(first.x - second.x, first.y - second.y);
        const hubF = (first.hub || second.hub) ? 1.6 : 1;
        const mouseF = Math.min(1.6, 1 + 1.2 * Math.min(first.raw, second.raw));
        const thr = base * hubF * mouseF;
        return { a, b, d, thr, key: Math.min(a, b) * 4096 + Math.max(a, b) };
      });
      if (links.some((link) => link.d >= link.thr)) continue;

      for (const link of links) {
        let e = edges.get(link.key);
        if (e) {
          e.target = 1; e.d = link.d; e.thr = link.thr;
        } else {
          e = { a: Math.min(link.a, link.b), b: Math.max(link.a, link.b), alpha: instant ? 1 : 0, target: 1, d: link.d, thr: link.thr };
          edges.set(link.key, e);
        }
      }
    }

    for (let i = 0; i < n; i++) adj[i].length = 0;
    const fade = Math.min(1, 0.05 * dt);
    for (const [key, e] of edges) {
      if (e.target === 0) { edges.delete(key); continue; }
      e.alpha += (e.target - e.alpha) * fade;
      if (instant) e.alpha = e.target;
      if (e.alpha > 0.25) { adj[e.a].push(e); adj[e.b].push(e); }
    }

    // propagate activation through the network
    const t1 = new Float32Array(n), t2 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const list = adj[i];
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        const v = nodes[e.a === i ? e.b : e.a].raw * 0.6;
        if (v > t1[i]) t1[i] = v;
      }
    }
    for (let i = 0; i < n; i++) {
      const list = adj[i];
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        const v = t1[e.a === i ? e.b : e.a] * 0.6;
        if (v > t2[i]) t2[i] = v;
      }
    }
    const lerp = Math.min(1, 0.1 * dt);
    for (let i = 0; i < n; i++) {
      const p = nodes[i];
      p.act += (Math.max(p.raw, t1[i], t2[i]) - p.act) * lerp;
      p.flash *= Math.pow(0.96, dt);
    }

    if (!instant) updatePulses(dt);
  }

  function spawnPulse(from, edge, hops, magenta) {
    if (pulses.length > 90) return;
    pulses.push({ e: edge, t: 0, dir: edge.a === from ? 1 : -1, hops, speed: 0.012 + Math.random() * 0.012, magenta });
  }

  function updatePulses(dt) {
    const n = nodes.length;
    if (Math.random() < 0.05 * dt) {
      const i = (Math.random() * n) | 0;
      const list = adj[i];
      if (list.length) spawnPulse(i, list[(Math.random() * list.length) | 0], 2 + ((Math.random() * 3) | 0), Math.random() < 0.12);
    }
    if (Math.random() < 0.03 * dt) nodes[(Math.random() * n) | 0].flash = 1;

    // pulses launched from the node nearest the cursor
    if (pointer.alive > 0.2 && Math.random() < (0.15 + pointer.boost * 0.5) * dt) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < n; i++) {
        const p = nodes[i];
        const d = (p.x - pointer.x) ** 2 + (p.y - pointer.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0 && adj[best].length) {
        nodes[best].flash = 1;
        spawnPulse(best, adj[best][(Math.random() * adj[best].length) | 0], 3 + ((Math.random() * 3) | 0), Math.random() < 0.2);
      }
    }

    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      p.t += p.speed * dt * (90 / Math.max(20, p.e.d)) * 1.4;
      if (p.t >= 1) {
        const arrive = p.dir > 0 ? p.e.b : p.e.a;
        nodes[arrive].flash = 1;
        const list = adj[arrive];
        if (p.hops > 0 && list.length > 1) {
          const next = list[(Math.random() * list.length) | 0];
          if (next !== p.e) {
            p.e = next; p.t = 0; p.dir = next.a === arrive ? 1 : -1; p.hops--;
            continue;
          }
        }
        pulses.splice(k, 1);
      }
    }
  }

  // ---- Rendering ----
  function line(x1, y1, x2, y2, rgb, a, lw) {
    ctx.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function dot(x, y, r, rgb, a) {
    ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fill();
  }

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // connections: violet / pale / cyan layers with a slight chromatic offset
    for (const e of edges.values()) {
      const a = nodes[e.a], b = nodes[e.b];
      const closeness = Math.max(0, 1 - e.d / (e.thr * 1.12));
      const act = (a.act + b.act) * 0.5;
      const alpha = e.alpha * ((0.07 + 0.3 * Math.sqrt(closeness)) * (0.55 + a.op * 0.25 + b.op * 0.2) + act * 0.65);
      if (alpha < 0.008) continue;
      const lw = 0.6 + act * 0.5;
      line(a.x - 1.1, a.y, b.x - 1.1, b.y, VIOLET, alpha, lw);
      line(a.x + 1.1, a.y, b.x + 1.1, b.y, CYAN, alpha, lw);
      line(a.x, a.y, b.x, b.y, PALE, alpha * 0.8, lw * 0.8);
    }

    // temporary links from the cursor to the nearest nodes
    if (pointer.alive > 0.01) {
      const near = [];
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        const d2 = (p.x - pointer.x) ** 2 + (p.y - pointer.y) ** 2;
        if (d2 < 200 * 200) near.push([d2, i]);
      }
      near.sort((x, y) => x[0] - y[0]);
      for (let k = 0; k < Math.min(4, near.length); k++) {
        const p = nodes[near[k][1]];
        const f = Math.exp(-near[k][0] / (150 * 150)) * pointer.alive;
        line(pointer.x, pointer.y, p.x, p.y, k === 0 ? MAGENTA : CYAN, f * 0.45, 0.6);
      }
    }

    for (const p of pulses) {
      const a = nodes[p.e.a], b = nodes[p.e.b];
      const t = p.dir > 0 ? p.t : 1 - p.t;
      const t0 = p.dir > 0 ? Math.max(0, t - 0.12) : Math.min(1, t + 0.12);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const x0 = a.x + (b.x - a.x) * t0, y0 = a.y + (b.y - a.y) * t0;
      const env = Math.sin(Math.PI * p.t);
      line(x0, y0, x, y, p.magenta ? MAGENTA : CYAN, 0.55 * env, 1.3);
      dot(x, y, 1.8, p.magenta ? MAGENTA : PALE, 0.95 * env);
    }

    // nodes: violet | pale | cyan triplets
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      const lit = Math.max(p.act, p.flash);
      const a = Math.min(1, p.op * (0.45 + 0.55 * lit));
      const r = p.r * (1 + lit * 0.25);
      const off = r * 1.25;
      if (lit > 0.25 || p.hub) dot(p.x, p.y, r * (3 + lit * 2), p.tint ? MAGENTA : CYAN, 0.05 + lit * 0.09);
      dot(p.x - off, p.y, r, p.tint ? MAGENTA : VIOLET, a);
      dot(p.x + off, p.y, r, CYAN, a);
      dot(p.x, p.y, r * 0.95, PALE, Math.min(1, a + 0.1));
    }
    if (pointer.alive > 0.01) {
      dot(pointer.x, pointer.y, 9, CYAN, 0.12 * pointer.alive);
      ctx.strokeStyle = 'rgba(' + PALE + ',' + (0.75 * pointer.alive).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 7, 0, 6.2832);
      ctx.stroke();
      dot(pointer.x, pointer.y, 2.2, PALE, pointer.alive);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let dt = (now - last) / 16.667;
    last = now;
    if (!(dt > 0)) dt = 1;
    dt = Math.min(dt, 3);
    time += 0.016 * dt;

    const sp = Math.hypot(pointer.x - pointer.px, pointer.y - pointer.py) / dt;
    pointer.px = pointer.x; pointer.py = pointer.y;
    pointer.boost += (Math.min(1, sp / 25) - pointer.boost) * 0.1;
    // emit a ripple each time the cursor travels far enough
    if (pointer.active && Math.hypot(pointer.x - lastRipple.x, pointer.y - lastRipple.y) > 140) {
      addRipple(pointer.x, pointer.y, 0.5 + pointer.boost * 0.5);
      lastRipple = { x: pointer.x, y: pointer.y };
    }
    const target = pointer.active ? 1 : 0;
    pointer.alive += (target - pointer.alive) * Math.min(1, (target ? 0.15 : 0.04) * dt);
    if (pointer.alive < 0.003 && !pointer.active) pointer.alive = 0;

    update(dt, false);
    draw();
  }

  function start() {
    cancelAnimationFrame(rafId);
    if (reduceMotion.matches) { update(0, true); draw(); return; }
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  // ---- Input ----
  function setPos(e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!pointer.active) { pointer.px = pointer.x; pointer.py = pointer.y; }
    pointer.active = true;
  }
  window.addEventListener('pointermove', (e) => { isTouch = e.pointerType === 'touch'; setPos(e); }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    isTouch = e.pointerType === 'touch';
    setPos(e);
    pointer.boost = 1;
    addRipple(e.clientX, e.clientY, 1);
    lastRipple = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  const release = (e) => { if (e.pointerType === 'touch') pointer.active = false; };
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.active = false; });

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); start(); }, 120); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId); else start();
  });
  reduceMotion.addEventListener('change', start);

  resize();
  start();
})();
