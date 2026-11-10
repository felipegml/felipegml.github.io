(() => {
  const canvas = document.getElementById('grid');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const bctx = bg.getContext('2d');

  const LINE_COLOR = '#85817D';
  let lightColor = '#F07813';
  const LINE_ALPHA = 0.11;
  const NODE_ALPHA = 0.2;
  const PULSE_ALPHA = 0.55;
  const PULSE_SPEED = 190;
  const PULSE_TRAIL = 90;
  const SEEK_BIAS = 0.9;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1, cell = 104, nodes = [], faces = [];
  let mx = 0, my = 0, hover = false;
  let pulses = [];
  let last = 0;

  function drawBackground() {
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, w, h);
    for (const face of faces) {
      const a = nodes[face.a], b = nodes[face.b], c = nodes[face.c];
      bctx.fillStyle = '#383838';
      bctx.globalAlpha = face.alpha;
      bctx.beginPath();
      bctx.moveTo(a.x, a.y);
      bctx.lineTo(b.x, b.y);
      bctx.lineTo(c.x, c.y);
      bctx.closePath();
      bctx.fill();
    }

    bctx.lineWidth = 1;
    for (const node of nodes) {
      for (const neighbor of node.neighbors) {
        if (neighbor <= node.index) continue;
        const target = nodes[neighbor];
        bctx.strokeStyle = LINE_COLOR;
        bctx.globalAlpha = LINE_ALPHA;
        bctx.beginPath();
        bctx.moveTo(node.x, node.y);
        bctx.lineTo(target.x, target.y);
        bctx.stroke();
      }
    }
    for (const node of nodes) {
      bctx.fillStyle = LINE_COLOR;
      bctx.globalAlpha = NODE_ALPHA;
      bctx.fillRect(node.x - 1, node.y - 1, 2, 2);
    }
    bctx.globalAlpha = 1;
  }

  function buildMesh() {
    nodes = [];
    faces = [];
    const spacing = cell;
    const cols = Math.ceil(w / spacing) + 2;
    const rows = Math.ceil(h / spacing) + 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        nodes.push({
          index: nodes.length,
          x: (i - 1 + 0.2 + Math.random() * 0.6) * spacing,
          y: (j - 1 + 0.2 + Math.random() * 0.6) * spacing,
          neighbors: [],
          lightAlpha: 0,
          lightTarget: false,
          lightTimer: 0
        });
      }
    }

    if (nodes.length < 3) return;

    const lightNodes = nodes.slice();
    const lightCount = Math.max(1, Math.round(nodes.length * 0.1));
    for (let i = 0; i < lightCount; i++) {
      const pick = i + Math.floor(Math.random() * (lightNodes.length - i));
      [lightNodes[i], lightNodes[pick]] = [lightNodes[pick], lightNodes[i]];
      lightNodes[i].lightAlpha = 1;
      lightNodes[i].lightTarget = true;
      lightNodes[i].lightTimer = 3 + Math.random() * 7;
    }

    const points = nodes.map(({ x, y }) => ({ x, y }));
    const span = Math.max(w, h);
    const centerX = w / 2, centerY = h / 2;
    points.push(
      { x: centerX - span * 20, y: centerY - span * 10 },
      { x: centerX, y: centerY + span * 20 },
      { x: centerX + span * 20, y: centerY - span * 10 }
    );

    const firstSuper = nodes.length;
    let triangles = [makeTriangle(firstSuper, firstSuper + 1, firstSuper + 2, points)];
    for (let pointIndex = 0; pointIndex < nodes.length; pointIndex++) {
      const boundary = new Map();
      const remaining = [];
      for (const triangle of triangles) {
        if (containsInCircumcircle(triangle, points[pointIndex], points)) {
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
        if (edge.count === 1) remaining.push(makeTriangle(edge.a, edge.b, pointIndex, points));
      }
      triangles = remaining;
    }

    for (const [a, b, c] of triangles) {
      if (a >= firstSuper || b >= firstSuper || c >= firstSuper) continue;
      faces.push({
        a,
        b,
        c,
        alpha: 0.035 + Math.random() * 0.075
      });
      connectNodes(a, b);
      connectNodes(b, c);
      connectNodes(c, a);
    }
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

  function connectNodes(a, b) {
    if (!nodes[a].neighbors.includes(b)) nodes[a].neighbors.push(b);
    if (!nodes[b].neighbors.includes(a)) nodes[b].neighbors.push(a);
  }

  function spawn(p) {
    const lightNodes = nodes.filter((node) => node.lightTarget);
    p.i = lightNodes[Math.floor(Math.random() * lightNodes.length)].index;
    p.previous = -1;
    p.next = undefined;
    p.hops = 8 + Math.floor(Math.random() * 20);
    p.speed = PULSE_SPEED * (0.7 + Math.random() * 0.6);
    p.len = 0;
    p.ending = false;
    p.x = nodes[p.i].x; p.y = nodes[p.i].y;
    p.trail = [p.x, p.y, p.x, p.y];
    pickNext(p);
  }

  // Choose a connected node, preferring the pointer's direction when hovering.
  function pickNext(p) {
    const neighbors = nodes[p.i].neighbors;
    if (!neighbors.length) { p.ending = true; return; }
    const candidates = neighbors.filter((index) => index !== p.previous);
    const options = candidates.length ? candidates : neighbors;
    if (hover) {
      const dx = mx - p.x, dy = my - p.y;
      if (Math.hypot(dx, dy) < cell * 0.6) {
        p.ending = true;
        return;
      }
      if (Math.random() < SEEK_BIAS) {
        let bestDistance = Infinity;
        let best = [];
        for (const index of options) {
          const node = nodes[index];
          const distance = (mx - node.x) ** 2 + (my - node.y) ** 2;
          if (distance < bestDistance) { bestDistance = distance; best = [index]; }
          else if (distance === bestDistance) best.push(index);
        }
        setNext(p, best[(Math.random() * best.length) | 0]);
        return;
      }
    }
    setNext(p, options[(Math.random() * options.length) | 0]);
  }

  function setNext(p, next) {
    if (p.next !== undefined && p.next !== next) p.trail.splice(p.trail.length - 2, 2, p.x, p.y, p.x, p.y);
    p.next = next;
  }

  function initPulses() {
    const count = Math.max(16, Math.round(nodes.length / 28));
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
      total += Math.hypot(t[k] - t[k - 2], t[k + 1] - t[k - 1]);
    }
    let excess = total - p.len;
    while (excess > 0 && t.length > 4) {
      const seg = Math.hypot(t[2] - t[0], t[3] - t[1]);
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
        const target = nodes[p.next];
        const dx = target.x - p.x, dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (move < dist) {
          p.x += dx / dist * move; p.y += dy / dist * move;
          move = 0;
        } else {
          p.x = target.x; p.y = target.y;
          p.previous = p.i;
          p.i = p.next;
          move -= dist;
          if (--p.hops <= 0) p.ending = true;
          else pickNext(p);
        }
      }
      const t = p.trail;
      t[t.length - 2] = p.x; t[t.length - 1] = p.y;
      trimTrail(p);
    }
  }

  function updateLights(dt) {
    for (const node of nodes) {
      if (node.lightTarget) {
        node.lightTimer -= dt;
        if (node.lightTimer <= 0) {
          const start = Math.floor(Math.random() * nodes.length);
          let replacement;
          for (let i = 0; i < nodes.length; i++) {
            const candidate = nodes[(start + i) % nodes.length];
            if (!candidate.lightTarget && candidate.lightAlpha < 0.01) {
              replacement = candidate;
              break;
            }
          }
          if (replacement) {
            node.lightTarget = false;
            replacement.lightTarget = true;
            replacement.lightTimer = 3 + Math.random() * 7;
          } else {
            node.lightTimer = 0.5;
          }
        }
      }
      const target = node.lightTarget ? 1 : 0;
      node.lightAlpha += (target - node.lightAlpha) * Math.min(1, dt / 1.1);
    }
  }

  function drawLights() {
    ctx.lineWidth = 1;
    for (const node of nodes) {
      for (const neighbor of node.neighbors) {
        if (neighbor <= node.index) continue;
        const target = nodes[neighbor];
        const strength = Math.max(node.lightAlpha, target.lightAlpha);
        if (strength < 0.01) continue;
        ctx.strokeStyle = lightColor;
        ctx.globalAlpha = strength * 0.26;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    }

    for (const node of nodes) {
      if (node.lightAlpha < 0.01) continue;
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 30);
      glow.addColorStop(0, lightColor);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.globalAlpha = node.lightAlpha * 0.14;
      ctx.fillRect(node.x - 30, node.y - 30, 60, 60);
      ctx.globalAlpha = node.lightAlpha;
      ctx.fillStyle = lightColor;
      ctx.fillRect(node.x - 1.5, node.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawPulses() {
    ctx.strokeStyle = lightColor;
    ctx.fillStyle = lightColor;
    ctx.lineWidth = 1.5;
    const STEP = 6;
    for (const p of pulses) {
      const t = p.trail;
      let dist = 0;
      for (let k = t.length - 2; k >= 2; k -= 2) {
        const ax = t[k], ay = t[k + 1], bx = t[k - 2], by = t[k - 1];
        const segLen = Math.hypot(bx - ax, by - ay);
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
    drawLights();
    drawPulses();
    if (hover) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = lightColor;
      ctx.fillRect(mx - 2, my - 2, 4, 4);
      ctx.strokeStyle = lightColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx - 7.5, my - 7.5, 15, 15);
    }
  }

  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
    last = t;
    updateLights(dt);
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
    cell = w < 600 ? 76 : w > 1600 ? 124 : 104;
    buildMesh();
    drawBackground();
    initPulses();
    render();
  }

  function track(x, y) {
    mx = x; my = y; hover = true;
    if (reduceMotion) render();
  }
  function release() {
    hover = false;
    if (reduceMotion) render();
  }

  window.addEventListener('pointermove', (e) => {
    if (e.target === canvas) track(e.clientX, e.clientY);
    else release();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('touchstart', (e) => {
    if (e.target === canvas) track(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.target === canvas) track(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchend', release);
  window.addEventListener('touchcancel', release);

  window.addEventListener('portfolio-light-change', (event) => {
    lightColor = event.detail;
    if (reduceMotion) render();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 60);
  });

  resize();
  if (!reduceMotion) requestAnimationFrame(frame);
})();
