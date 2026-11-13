(() => {
  'use strict';

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isConstellationSky = document.body.dataset.sky === 'constellations';
  const sky = isConstellationSky ? window.constellationSky : null;
  if (isConstellationSky && !sky) {
    document.getElementById('sky-error').hidden = false;
    console.error('Unable to load the constellation sky data.');
    return;
  }
  const VIOLET = '139,92,246';
  const CYAN = '0,229,255';
  const PALE = '225,250,255';
  const MAGENTA = '255,45,149';
  const NEAR = 0.05;
  const BASE_DISTANCE = 0.23;

  let w = 0, h = 0, focal = 1, rafId = 0, last = 0, time = 0;
  const camera = {
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: 1 }
  };
  if (sky) {
    const angle = 84 * Math.PI / 180;
    camera.right = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    camera.forward = { x: -Math.sin(angle), y: 0, z: Math.cos(angle) };
  }
  let drag = null;
  const pointer = { x: 0, y: 0, active: false, touch: false };
  let lastRipple = { x: -9999, y: -9999 };
  const pulses = [];
  const ripples = [];
  const nodes = [];
  const edges = [];
  const triangles = [];
  const adjacency = [];
  const constellationInfo = sky ? document.getElementById('constellation-info') : null;
  let hoveredConstellation = null, selectedConstellation = null;

  function normalize(x, y, z) {
    const length = Math.hypot(x, y, z);
    return { x: x / length, y: y / length, z: z / length };
  }

  function gauss() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  function randomDirection() {
    const y = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(1 - y * y);
    return { x: radius * Math.cos(angle), y, z: radius * Math.sin(angle) };
  }

  function addNode(p, hub, magnitude) {
    const tangent = Math.abs(p.y) < 0.9
      ? normalize(p.z, 0, -p.x)
      : normalize(0, -p.z, p.y);
    const tangent2 = {
      x: p.y * tangent.z - p.z * tangent.y,
      y: p.z * tangent.x - p.x * tangent.z,
      z: p.x * tangent.y - p.y * tangent.x
    };
    nodes.push({
      ...p, tangent, tangent2, hub,
      r: sky ? Math.max(0.65, Math.min(2.8, 2.5 - magnitude * 0.3)) : (hub ? 2.6 + Math.random() : 1.1 + Math.random() * 0.9),
      op: sky ? Math.max(0.3, Math.min(1, (7 - magnitude) / 5)) : 0.55 + Math.random() * 0.45,
      tint: Math.random() < 0.08,
      ax: sky ? 0 : 0.003 + Math.random() * 0.009, ay: sky ? 0 : 0.003 + Math.random() * 0.009,
      sxSpeed: 0.04 + Math.random() * 0.09, sySpeed: 0.04 + Math.random() * 0.09,
      px: Math.random() * Math.PI * 2, py: Math.random() * Math.PI * 2,
      ox: 0, oy: 0, raw: 0, act: 0, flash: 0,
      cx: 0, cy: 0, cz: 0, sx: 0, sy: 0, visible: false
    });
    adjacency.push([]);
  }

  function makeFace(a, b, c) {
    const p = nodes[a], q = nodes[b], r = nodes[c];
    const ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z;
    const vx = r.x - p.x, vy = r.y - p.y, vz = r.z - p.z;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * p.x + ny * p.y + nz * p.z < 0) {
      [b, c] = [c, b];
      nx = -nx; ny = -ny; nz = -nz;
    }
    return { a, b, c, nx, ny, nz, distance: nx * p.x + ny * p.y + nz * p.z };
  }

  function celestialDirection(ra, dec) {
    const longitude = ra * Math.PI / 180, latitude = dec * Math.PI / 180;
    return {
      x: -Math.cos(latitude) * Math.sin(longitude),
      y: Math.sin(latitude),
      z: Math.cos(latitude) * Math.cos(longitude)
    };
  }

  function buildConstellationSky() {
    const connected = new Set();
    const edgeKeys = new Set();
    for (const [a, b] of sky.lines) {
      connected.add(a);
      connected.add(b);
    }
    for (let i = 0; i < sky.stars.length; i++) {
      const [ra, dec, magnitude] = sky.stars[i];
      const direction = connected.has(i) ? celestialDirection(ra, dec) : randomDirection();
      addNode(direction, connected.has(i), magnitude);
    }
    for (const [a, b, constellations] of sky.lines) {
      edges.push({ a, b, constellations, alpha: 1, target: 1, d: 0 });
      edgeKeys.add(Math.min(a, b) * nodes.length + Math.max(a, b));
    }

    const radius = 0.065;
    const cells = new Map();
    function cellKey(x, y, z) {
      return x + ':' + y + ':' + z;
    }
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      const x = Math.floor((p.x + 1) / radius), y = Math.floor((p.y + 1) / radius), z = Math.floor((p.z + 1) / radius);
      const key = cellKey(x, y, z);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(i);
    }
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i], candidates = [];
      const x = Math.floor((p.x + 1) / radius), y = Math.floor((p.y + 1) / radius), z = Math.floor((p.z + 1) / radius);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const cell = cells.get(cellKey(x + dx, y + dy, z + dz));
            if (!cell) continue;
            for (const j of cell) {
              if (i === j) continue;
              const a = Math.min(i, j), b = Math.max(i, j);
              const key = a * nodes.length + b;
              if (edgeKeys.has(key)) continue;
              const q = nodes[j];
              const distance = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2;
              if (distance < radius * radius) candidates.push({ a, b, key, distance });
            }
          }
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      for (const candidate of candidates.slice(0, 2)) {
        if (edgeKeys.has(candidate.key)) continue;
        edgeKeys.add(candidate.key);
        edges.push({ a: candidate.a, b: candidate.b, constellations: null, alpha: 1, target: 1, d: 0 });
      }
    }
  }

  function buildSphere() {
    const count = 1600;
    for (const [x, y, z] of [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]) {
      addNode(normalize(x, y, z), false);
    }
    const centers = [];
    for (let i = 0; i < Math.round(count / 22); i++) {
      const center = randomDirection();
      centers.push(center);
      addNode(center, true);
    }
    while (nodes.length < count) {
      let p = randomDirection();
      if (Math.random() < 0.72) {
        const center = centers[(Math.random() * centers.length) | 0];
        p = normalize(center.x + gauss() * 0.13, center.y + gauss() * 0.13, center.z + gauss() * 0.13);
      }
      addNode(p, Math.random() < 0.035);
    }

    // The convex hull of points on a sphere gives a seam-free spherical triangulation.
    let faces = [makeFace(0, 1, 2), makeFace(0, 3, 1), makeFace(0, 2, 3), makeFace(1, 3, 2)];
    for (let index = 4; index < nodes.length; index++) {
      const p = nodes[index], boundary = new Map(), remaining = [];
      for (const face of faces) {
        if (face.nx * p.x + face.ny * p.y + face.nz * p.z > face.distance + 1e-12) {
          for (const [a, b] of [[face.a, face.b], [face.b, face.c], [face.c, face.a]]) {
            const key = Math.min(a, b) + ':' + Math.max(a, b);
            if (boundary.has(key)) boundary.delete(key);
            else boundary.set(key, [a, b]);
          }
        } else {
          remaining.push(face);
        }
      }
      for (const [a, b] of boundary.values()) remaining.push(makeFace(a, b, index));
      faces = remaining;
    }

    const seen = new Map();
    function getEdge(a, b) {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const key = lo + ':' + hi;
      if (!seen.has(key)) {
        const edge = { a: lo, b: hi, alpha: 0, target: 0, d: 0, threshold: BASE_DISTANCE };
        seen.set(key, edge);
        edges.push(edge);
      }
      return seen.get(key);
    }
    for (const { a, b, c } of faces) {
      triangles.push([getEdge(a, b), getEdge(b, c), getEdge(c, a)]);
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    focal = Math.max(1, h / 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(0, true);
  }

  function projectNodes(dt, instant) {
    for (const p of nodes) {
      const ox = Math.sin(time * p.sxSpeed + p.px) * p.ax;
      const oy = Math.cos(time * p.sySpeed + p.py) * p.ay;
      const v = normalize(
        p.x + p.tangent.x * ox + p.tangent2.x * oy,
        p.y + p.tangent.y * ox + p.tangent2.y * oy,
        p.z + p.tangent.z * ox + p.tangent2.z * oy
      );
      p.cx = camera.right.x * v.x + camera.right.y * v.y + camera.right.z * v.z;
      p.cy = camera.up.x * v.x + camera.up.y * v.y + camera.up.z * v.z;
      p.cz = camera.forward.x * v.x + camera.forward.y * v.y + camera.forward.z * v.z;
      p.visible = false;
      p.raw = 0;
      if (p.cz < NEAR) continue;
      p.sx = w / 2 + focal * p.cx / p.cz;
      p.sy = h / 2 - focal * p.cy / p.cz;
      let tox = 0, toy = 0;
      const dx = pointer.x - p.sx, dy = pointer.y - p.sy;
      const distance = Math.hypot(dx, dy) + 0.001;
      const radius = pointer.touch ? 130 : 175;
      if (pointer.active && distance < radius * 2) {
        p.raw = Math.exp(-(distance * distance) / (radius * radius));
        if (!instant) {
          const magnitude = 7 * p.raw * (distance / radius - 0.4) / 0.6;
          tox += dx / distance * magnitude;
          toy += dy / distance * magnitude;
        }
      }
      if (pointer.active && !instant) {
        const swirl = pointer.touch ? 220 : 320;
        if (distance < swirl * 2.2) {
          const strength = Math.exp(-(distance * distance) / (swirl * swirl));
          const angle = strength * (0.5 + 0.35 * Math.sin(distance * 0.025 - time * 2.2));
          tox += dy * angle * 0.18;
          toy -= dx * angle * 0.18;
        }
      }
      if (!instant) {
        for (const ripple of ripples) {
          const rx = p.sx - ripple.x, ry = p.sy - ripple.y;
          const rd = Math.hypot(rx, ry) + 0.001;
          const band = (rd - ripple.r) / 45;
          if (band > -3 && band < 3) {
            const magnitude = Math.exp(-band * band) * ripple.alpha * 26;
            tox += rx / rd * magnitude;
            toy += ry / rd * magnitude;
          }
        }
        if (sky) { tox *= 0.2; toy *= 0.2; }
        const easing = Math.min(1, 0.1 * dt);
        p.ox += (tox - p.ox) * easing;
        p.oy += (toy - p.oy) * easing;
      }
      if (p.ox || p.oy) {
        const shifted = normalize((p.sx + p.ox - w / 2) / focal, -(p.sy + p.oy - h / 2) / focal, 1);
        p.cx = shifted.x; p.cy = shifted.y; p.cz = shifted.z;
        p.sx += p.ox; p.sy += p.oy;
      }
      p.visible = p.sx >= -20 && p.sx <= w + 20 && p.sy >= -20 && p.sy <= h + 20;
    }
  }

  function projectedSegment(a, b) {
    let x1 = a.cx, y1 = a.cy, z1 = a.cz;
    let x2 = b.cx, y2 = b.cy, z2 = b.cz;
    if (z1 < NEAR && z2 < NEAR) return null;
    if (z1 < NEAR) {
      const t = (NEAR - z1) / (z2 - z1);
      x1 += (x2 - x1) * t;
      y1 += (y2 - y1) * t;
      z1 = NEAR;
    } else if (z2 < NEAR) {
      const t = (NEAR - z2) / (z1 - z2);
      x2 += (x1 - x2) * t;
      y2 += (y1 - y2) * t;
      z2 = NEAR;
    }
    x1 = w / 2 + focal * x1 / z1;
    y1 = h / 2 - focal * y1 / z1;
    x2 = w / 2 + focal * x2 / z2;
    y2 = h / 2 - focal * y2 / z2;

    const dx = x2 - x1, dy = y2 - y1;
    let start = 0, end = 1;
    for (const [p, q] of [[-dx, x1], [dx, w - x1], [-dy, y1], [dy, h - y1]]) {
      if (p === 0) {
        if (q < 0) return null;
      } else {
        const t = q / p;
        if (p < 0) start = Math.max(start, t);
        else end = Math.min(end, t);
        if (start > end) return null;
      }
    }
    return [x1 + start * dx, y1 + start * dy, x1 + end * dx, y1 + end * dy];
  }

  function updateNetwork(dt, instant) {
    const first = new Float32Array(nodes.length);
    const second = new Float32Array(nodes.length);
    const screenBase = Math.max(65, Math.min(125, Math.min(w, h) * 0.12));
    for (const edge of edges) {
      const a = nodes[edge.a], b = nodes[edge.b];
      edge.d = Math.hypot(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz);
      if (sky) continue;
      const factor = (a.hub || b.hub ? 1.6 : 1) * Math.min(1.6, 1 + 1.2 * Math.min(a.raw, b.raw));
      edge.threshold = BASE_DISTANCE * factor;
      edge.ratio = edge.d / edge.threshold;
      if (a.cz >= NEAR && b.cz >= NEAR) {
        edge.ratio = Math.max(edge.ratio, Math.hypot(a.sx - b.sx, a.sy - b.sy) / (screenBase * factor));
      }
      edge.target = 0;
    }
    for (const triangle of triangles) {
      if (triangle.every((edge) => edge.ratio < 1)) {
        for (const edge of triangle) edge.target = 1;
      }
    }
    for (const list of adjacency) list.length = 0;
    for (const edge of edges) {
      edge.alpha += (edge.target - edge.alpha) * (instant ? 1 : Math.min(1, 0.05 * dt));
      if (edge.alpha > 0.25) {
        adjacency[edge.a].push(edge);
        adjacency[edge.b].push(edge);
      }
    }
    for (const edge of edges) {
      if (edge.alpha <= 0.25) continue;
      first[edge.a] = Math.max(first[edge.a], nodes[edge.b].raw * 0.6);
      first[edge.b] = Math.max(first[edge.b], nodes[edge.a].raw * 0.6);
    }
    for (const edge of edges) {
      if (edge.alpha <= 0.25) continue;
      second[edge.a] = Math.max(second[edge.a], first[edge.b] * 0.6);
      second[edge.b] = Math.max(second[edge.b], first[edge.a] * 0.6);
    }
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      const target = Math.max(p.raw, first[i], second[i]);
      p.act += (target - p.act) * (instant ? 1 : Math.min(1, 0.1 * dt));
      p.flash *= Math.pow(0.96, dt);
    }
  }

  function updatePulses(dt) {
    if (Math.random() < 0.06 * dt && pulses.length < 90) {
      const from = (Math.random() * nodes.length) | 0;
      const list = adjacency[from];
      if (list.length) {
        const edge = list[(Math.random() * list.length) | 0];
        pulses.push({ edge, from, t: 0, hops: 2 + ((Math.random() * 3) | 0), magenta: Math.random() < 0.12 });
      }
    }
    if (Math.random() < 0.03 * dt) nodes[(Math.random() * nodes.length) | 0].flash = 1;
    if (pointer.active && Math.random() < 0.15 * dt && pulses.length < 90) {
      let closest = -1, distance = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (!p.visible || !adjacency[i].length) continue;
        const d = (p.sx - pointer.x) ** 2 + (p.sy - pointer.y) ** 2;
        if (d < distance) { closest = i; distance = d; }
      }
      if (closest >= 0) {
        const list = adjacency[closest];
        nodes[closest].flash = 1;
        pulses.push({ edge: list[(Math.random() * list.length) | 0], from: closest, t: 0, hops: 3, magenta: Math.random() < 0.2 });
      }
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i];
      if (pulse.edge.alpha <= 0.25) {
        pulses.splice(i, 1);
        continue;
      }
      pulse.t += 0.018 * dt * Math.min(3, BASE_DISTANCE / Math.max(0.03, pulse.edge.d));
      if (pulse.t < 1) continue;
      const arrival = pulse.edge.a === pulse.from ? pulse.edge.b : pulse.edge.a;
      nodes[arrival].flash = 1;
      const choices = adjacency[arrival].filter((edge) => edge !== pulse.edge);
      if (pulse.hops > 0 && choices.length) {
        pulse.from = arrival;
        pulse.edge = choices[(Math.random() * choices.length) | 0];
        pulse.t = 0;
        pulse.hops--;
      } else {
        pulses.splice(i, 1);
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].r += 5 * dt;
      ripples[i].alpha *= Math.pow(0.96, dt);
      if (ripples[i].alpha < 0.02) ripples.splice(i, 1);
    }
  }

  function line(x1, y1, x2, y2, rgb, alpha, width) {
    ctx.strokeStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function dot(x, y, radius, rgb, alpha) {
    ctx.fillStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function pointOnEdge(a, b, t) {
    return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, cz: a.cz + (b.cz - a.cz) * t };
  }

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const edge of edges) {
      if (edge.alpha < 0.008) continue;
      const a = nodes[edge.a], b = nodes[edge.b];
      const segment = projectedSegment(a, b);
      if (!segment) continue;
      const [x1, y1, x2, y2] = segment;
      const act = (a.act + b.act) * 0.5;
      if (sky) {
        line(x1, y1, x2, y2, CYAN, edge.constellations ? 0.5 : 0.1, 0.8 + act * 0.5);
        continue;
      }
      const closeness = Math.max(0, 1 - edge.ratio / 1.12);
      const alpha = Math.min(1, edge.alpha * ((0.07 + 0.3 * Math.sqrt(closeness))
        * (0.55 + a.op * 0.25 + b.op * 0.2) + act * 0.65));
      const width = 0.6 + act * 0.5;
      line(x1 - 1.1, y1, x2 - 1.1, y2, VIOLET, alpha, width);
      line(x1 + 1.1, y1, x2 + 1.1, y2, CYAN, alpha, width);
      line(x1, y1, x2, y2, PALE, alpha * 0.8, width * 0.8);
    }

    for (const pulse of pulses) {
      const a = nodes[pulse.from];
      const b = nodes[pulse.edge.a === pulse.from ? pulse.edge.b : pulse.edge.a];
      const head = pointOnEdge(a, b, pulse.t);
      const tail = pointOnEdge(a, b, Math.max(0, pulse.t - 0.12));
      const segment = projectedSegment(tail, head);
      if (!segment || head.cz < NEAR) continue;
      const env = Math.sin(Math.PI * pulse.t);
      const faint = sky && !pulse.edge.constellations;
      line(...segment, pulse.magenta ? MAGENTA : CYAN, Math.min(faint ? 0.3 : 1, 0.55 * env), 1.3);
      const x = w / 2 + focal * head.cx / head.cz;
      const y = h / 2 - focal * head.cy / head.cz;
      if (x >= 0 && x <= w && y >= 0 && y <= h) {
        dot(x, y, 1.8, pulse.magenta ? MAGENTA : PALE, Math.min(faint ? 0.3 : 1, 0.95 * env));
      }
    }

    for (const p of nodes) {
      if (!p.visible) continue;
      const lit = Math.max(p.act, p.flash);
      const alpha = Math.min(1, p.op * (0.45 + 0.55 * lit));
      const radius = p.r * (1 + lit * 0.25);
      if (sky && !p.hub) {
        dot(p.sx, p.sy, radius, CYAN, Math.min(0.3, alpha));
        continue;
      }
      const offset = radius * 1.25;
      if (lit > 0.25 || p.hub) dot(p.sx, p.sy, radius * (3 + lit * 2), p.tint ? MAGENTA : CYAN, 0.05 + lit * 0.09);
      dot(p.sx - offset, p.sy, radius, p.tint ? MAGENTA : VIOLET, alpha);
      dot(p.sx + offset, p.sy, radius, CYAN, alpha);
      dot(p.sx, p.sy, radius * 0.95, PALE, Math.min(1, alpha + 0.1));
    }

    if (pointer.active) {
      const near = nodes.filter((p) => p.visible)
        .map((p) => ({ p, d2: (p.sx - pointer.x) ** 2 + (p.sy - pointer.y) ** 2 }))
        .filter((entry) => entry.d2 < 200 * 200)
        .sort((a, b) => a.d2 - b.d2);
      for (let i = 0; i < Math.min(4, near.length); i++) {
        const entry = near[i];
        const alpha = Math.exp(-entry.d2 / (150 * 150)) * 0.45;
        line(pointer.x, pointer.y, entry.p.sx, entry.p.sy, i === 0 ? MAGENTA : CYAN,
          sky && !entry.p.hub ? Math.min(0.3, alpha) : alpha, 0.6);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function render(dt, instant) {
    projectNodes(dt, instant);
    updateNetwork(dt, instant);
    if (!instant) updatePulses(dt);
    draw();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 16.667 || 1, 3);
    last = now;
    time += 0.016 * dt;
    render(dt, false);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (document.hidden) return;
    if (reduceMotion.matches) {
      pulses.length = 0;
      ripples.length = 0;
      for (const node of nodes) {
        node.flash = 0;
        node.ox = 0;
        node.oy = 0;
      }
      render(0, true);
      return;
    }
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function redrawIfStill() {
    if (reduceMotion.matches && !document.hidden) render(0, true);
  }

  function constellationAt(x, y) {
    let closest = null, bestDistance = 14 * 14;
    for (const edge of edges) {
      if (!edge.constellations) continue;
      const segment = projectedSegment(nodes[edge.a], nodes[edge.b]);
      if (!segment) continue;
      const [x1, y1, x2, y2] = segment;
      const dx = x2 - x1, dy = y2 - y1;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared)) : 0;
      const distance = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = edge.constellations[0];
      }
    }
    return closest;
  }

  function updateConstellationInfo() {
    const index = hoveredConstellation === null ? selectedConstellation : hoveredConstellation;
    constellationInfo.hidden = index === null;
    constellationInfo.textContent = index === null ? '' : sky.labels[index][0];
  }

  function rotate(dx, dy) {
    const yaw = -dx / focal, pitch = dy / focal;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const right = camera.right, up = camera.up, forward = camera.forward;
    const turnedForward = {
      x: forward.x * cy + right.x * sy,
      y: forward.y * cy + right.y * sy,
      z: forward.z * cy + right.z * sy
    };
    camera.right = normalize(right.x * cy - forward.x * sy, right.y * cy - forward.y * sy, right.z * cy - forward.z * sy);
    camera.forward = normalize(turnedForward.x * cp + up.x * sp, turnedForward.y * cp + up.y * sp, turnedForward.z * cp + up.z * sp);
    camera.up = normalize(
      camera.forward.y * camera.right.z - camera.forward.z * camera.right.y,
      camera.forward.z * camera.right.x - camera.forward.x * camera.right.z,
      camera.forward.x * camera.right.y - camera.forward.y * camera.right.x
    );
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    if (sky) {
      hoveredConstellation = null;
      updateConstellationInfo();
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.touch = event.pointerType === 'touch';
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
    if (!reduceMotion.matches && ripples.length < 6) ripples.push({ x: pointer.x, y: pointer.y, r: 0, alpha: 1 });
    lastRipple = { x: pointer.x, y: pointer.y };
    redrawIfStill();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag && event.pointerId !== drag.id) return;
    if (drag) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) drag.moved = true;
      rotate(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
    } else if (event.pointerType !== 'mouse') {
      return;
    }
    if (sky && !drag) {
      hoveredConstellation = constellationAt(event.clientX, event.clientY);
      updateConstellationInfo();
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.touch = event.pointerType === 'touch';
    if (!reduceMotion.matches && ripples.length < 6 && Math.hypot(pointer.x - lastRipple.x, pointer.y - lastRipple.y) > 140) {
      ripples.push({ x: pointer.x, y: pointer.y, r: 0, alpha: 0.5 });
      lastRipple = { x: pointer.x, y: pointer.y };
    }
    redrawIfStill();
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (sky && event.type === 'pointerup' && !drag.moved
      && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 8) {
      selectedConstellation = constellationAt(event.clientX, event.clientY);
    }
    drag = null;
    canvas.classList.remove('dragging');
    if (event.pointerType !== 'mouse' || event.type !== 'pointerup'
      || event.clientX < 0 || event.clientX > w || event.clientY < 0 || event.clientY > h) pointer.active = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (sky) {
      hoveredConstellation = event.pointerType === 'mouse' && pointer.active
        ? constellationAt(event.clientX, event.clientY) : null;
      updateConstellationInfo();
    }
    redrawIfStill();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (!drag) {
      pointer.active = false;
      if (sky) {
        hoveredConstellation = null;
        updateConstellationInfo();
      }
      redrawIfStill();
    }
  });
  canvas.addEventListener('keydown', (event) => {
    const step = focal * 0.12;
    if (event.key === 'ArrowLeft') rotate(step, 0);
    else if (event.key === 'ArrowRight') rotate(-step, 0);
    else if (event.key === 'ArrowUp') rotate(0, step);
    else if (event.key === 'ArrowDown') rotate(0, -step);
    else return;
    event.preventDefault();
    redrawIfStill();
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  reduceMotion.addEventListener('change', start);

  if (sky) buildConstellationSky(); else buildSphere();
  resize();
  start();
})();
