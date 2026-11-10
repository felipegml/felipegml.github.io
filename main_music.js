(() => {
  'use strict';

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const status = document.getElementById('status');
  const motionMessage = document.getElementById('motion');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = { violet: '139,92,246', cyan: '0,229,255', pale: '225,250,255', magenta: '255,45,149' };

  let width = 0, height = 0, time = 0, last = 0, rafId = 0;
  let nodes = [], edges = [], ripples = [], pulses = [];
  let stream = null, audioContext = null, analyser = null, samples = null;
  let pending = false, captureId = 0, lastBeat = 0, previousBass = 0;
  const bands = [0, 0, 0];

  function triangle(a, b, c, points) {
    const p = points[a], q = points[b], r = points[c];
    return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) >= 0
      ? [a, b, c] : [a, c, b];
  }

  function contains(tri, point, points) {
    const a = points[tri[0]], b = points[tri[1]], c = points[tri[2]];
    const ax = a.x - point.x, ay = a.y - point.y;
    const bx = b.x - point.x, by = b.y - point.y;
    const cx = c.x - point.x, cy = c.y - point.y;
    return (ax * ax + ay * ay) * (bx * cy - cx * by)
      - (bx * bx + by * by) * (ax * cy - cx * ay)
      + (cx * cx + cy * cy) * (ax * by - bx * ay) > 0;
  }

  function buildEdges() {
    const points = nodes.map((node) => ({ x: node.hx, y: node.hy }));
    const span = Math.max(width, height);
    const superIndex = points.length;
    points.push(
      { x: width / 2 - span * 20, y: height / 2 - span * 10 },
      { x: width / 2, y: height / 2 + span * 20 },
      { x: width / 2 + span * 20, y: height / 2 - span * 10 }
    );
    let triangles = [triangle(superIndex, superIndex + 1, superIndex + 2, points)];
    for (let i = 0; i < superIndex; i++) {
      const boundary = new Map(), remaining = [];
      for (const tri of triangles) {
        if (!contains(tri, points[i], points)) {
          remaining.push(tri);
          continue;
        }
        for (let j = 0; j < 3; j++) {
          const a = tri[j], b = tri[(j + 1) % 3];
          const key = Math.min(a, b) + ':' + Math.max(a, b);
          const entry = boundary.get(key);
          if (entry) entry.count++;
          else boundary.set(key, { a, b, count: 1 });
        }
      }
      for (const edge of boundary.values()) {
        if (edge.count === 1) remaining.push(triangle(edge.a, edge.b, i, points));
      }
      triangles = remaining;
    }

    const links = new Map();
    const base = Math.max(65, Math.min(125, Math.min(width, height) * 0.12));
    for (const tri of triangles) {
      if (tri.some((index) => index >= superIndex)) continue;
      const pairs = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]];
      if (pairs.some(([a, b]) => Math.hypot(nodes[a].hx - nodes[b].hx, nodes[a].hy - nodes[b].hy)
        >= base * (nodes[a].hub || nodes[b].hub ? 1.6 : 1))) continue;
      for (const [a, b] of pairs) {
        const key = Math.min(a, b) + ':' + Math.max(a, b);
        links.set(key, { a, b });
      }
    }
    edges = Array.from(links.values());
  }

  function gaussian() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cap = width < 700 ? 140 : 360;
    const count = Math.max(60, Math.min(cap, Math.round(width * height / 7000)));
    const centerCount = Math.max(4, Math.round(count / 22));
    const centers = Array.from({ length: centerCount }, () => ({ x: Math.random() * width, y: Math.random() * height }));
    const sigma = Math.min(width, height) * 0.09;
    nodes = Array.from({ length: count }, (_, i) => {
      const hub = i < centerCount || Math.random() < 0.035;
      const center = centers[i < centerCount ? i : Math.floor(Math.random() * centerCount)];
      const clustered = i < centerCount || Math.random() < 0.72;
      const x = i < centerCount ? center.x : clustered ? center.x + gaussian() * sigma : Math.random() * width;
      const y = i < centerCount ? center.y : clustered ? center.y + gaussian() * sigma : Math.random() * height;
      const hx = Math.min(width + 30, Math.max(-30, x));
      const hy = Math.min(height + 30, Math.max(-30, y));
      return {
        hx, hy, x: hx, y: hy, hub, band: i % 3, phase: Math.random() * Math.PI * 2,
        radius: hub ? 2.6 + Math.random() : 1.1 + Math.random() * 0.9,
        opacity: 0.55 + Math.random() * 0.45, tint: Math.random() < 0.08
      };
    });
    ripples = [];
    pulses = [];
    buildEdges();
    draw();
  }

  function line(x1, y1, x2, y2, color, alpha, lineWidth) {
    ctx.strokeStyle = 'rgba(' + color + ',' + Math.min(1, alpha).toFixed(3) + ')';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function dot(x, y, radius, color, alpha) {
    ctx.fillStyle = 'rgba(' + color + ',' + Math.min(1, alpha).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const edge of edges) {
      const a = nodes[edge.a], b = nodes[edge.b];
      const activation = (bands[a.band] + bands[b.band]) / 2;
      const alpha = 0.16 + activation * 0.55;
      line(a.x - 1.1, a.y, b.x - 1.1, b.y, colors.violet, alpha, 0.6 + activation * 0.5);
      line(a.x + 1.1, a.y, b.x + 1.1, b.y, colors.cyan, alpha, 0.6 + activation * 0.5);
      line(a.x, a.y, b.x, b.y, colors.pale, alpha * 0.8, 0.5);
    }
    for (const pulse of pulses) {
      const a = nodes[pulse.edge.a], b = nodes[pulse.edge.b];
      const x = a.x + (b.x - a.x) * pulse.progress;
      const y = a.y + (b.y - a.y) * pulse.progress;
      dot(x, y, 2, colors.pale, Math.sin(Math.PI * pulse.progress) * 0.9);
    }
    for (const node of nodes) {
      const activation = bands[node.band];
      const radius = node.radius * (1 + activation * 0.4);
      const alpha = node.opacity * (0.45 + activation * 0.55);
      if (activation > 0.2 || node.hub) dot(node.x, node.y, radius * (3 + activation * 2), node.tint ? colors.magenta : colors.cyan, 0.05 + activation * 0.09);
      dot(node.x - radius * 1.25, node.y, radius, node.tint ? colors.magenta : colors.violet, alpha);
      dot(node.x + radius * 1.25, node.y, radius, colors.cyan, alpha);
      dot(node.x, node.y, radius * 0.95, colors.pale, alpha + 0.1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function readAudio(dt) {
    const targets = [0, 0, 0];
    if (analyser && audioContext) {
      analyser.getByteFrequencyData(samples);
      const ranges = [[40, 250], [250, 2000], [2000, 8000]];
      const binWidth = audioContext.sampleRate / analyser.fftSize;
      ranges.forEach(([low, high], index) => {
        const first = Math.max(0, Math.floor(low / binWidth));
        const end = Math.min(samples.length, Math.ceil(high / binWidth));
        let sum = 0;
        for (let i = first; i < end; i++) sum += samples[i];
        targets[index] = end > first ? Math.min(1, sum / (end - first) / 180) : 0;
      });
    }
    const smoothing = 1 - Math.exp(-dt * 8);
    for (let i = 0; i < bands.length; i++) bands[i] += (targets[i] - bands[i]) * smoothing;
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    readAudio(dt);
    if (bands[0] > 0.25 && bands[0] - previousBass > 0.035 && time - lastBeat > 0.3) {
      ripples.push({ x: Math.random() * width, y: Math.random() * height, radius: 0, strength: bands[0] });
      if (ripples.length > 6) ripples.shift();
      lastBeat = time;
      for (let i = 0; i < 4 && edges.length; i++) {
        pulses.push({ edge: edges[Math.floor(Math.random() * edges.length)], progress: 0 });
      }
    }
    previousBass = bands[0];
    ripples = ripples.filter((ripple) => {
      ripple.radius += dt * 300;
      ripple.strength *= Math.exp(-dt * 1.5);
      return ripple.strength > 0.03;
    });
    pulses = pulses.filter((pulse) => {
      pulse.progress += dt * 1.4;
      return pulse.progress < 1;
    });
    for (const node of nodes) {
      const activation = bands[node.band];
      node.x = node.hx + Math.sin(time * 0.3 + node.phase) * (3 + activation * 18);
      node.y = node.hy + Math.cos(time * 0.25 + node.phase) * (3 + activation * 18);
      for (const ripple of ripples) {
        const dx = node.x - ripple.x, dy = node.y - ripple.y;
        const distance = Math.hypot(dx, dy) || 1;
        const band = (distance - ripple.radius) / 45;
        const displacement = Math.exp(-band * band) * ripple.strength * 26;
        node.x += dx / distance * displacement;
        node.y += dy / distance * displacement;
      }
    }
    draw();
  }

  function startAnimation() {
    cancelAnimationFrame(rafId);
    motionMessage.hidden = !reduceMotion.matches;
    if (reduceMotion.matches) {
      bands.fill(0);
      ripples = [];
      pulses = [];
      for (const node of nodes) { node.x = node.hx; node.y = node.hy; }
      draw();
    } else if (!document.hidden) {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  function stopCapture(message) {
    captureId++;
    pending = false;
    const oldStream = stream, oldContext = audioContext;
    stream = null;
    audioContext = null;
    analyser = null;
    samples = null;
    if (oldStream) oldStream.getTracks().forEach((track) => track.stop());
    if (oldContext && oldContext.state !== 'closed') {
      oldContext.close().catch((error) => console.error('Unable to close audio context:', error));
    }
    startButton.disabled = false;
    stopButton.disabled = true;
    status.textContent = message;
  }

  startButton.addEventListener('click', async () => {
    if (pending || stream) return;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.AudioContext) {
      status.textContent = 'Audio sharing is not available here. Use HTTPS or localhost and a browser that supports screen sharing with audio.';
      return;
    }
    pending = true;
    const id = ++captureId;
    startButton.disabled = true;
    status.textContent = 'Choose a tab or screen and enable audio sharing in the browser dialog.';
    let selectedStream = null;
    let context = null;
    try {
      context = new AudioContext();
      audioContext = context;
      const resumed = context.resume().then(() => ({ ok: true }), (error) => ({ ok: false, error }));
      selectedStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (id !== captureId) {
        selectedStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = selectedStream;
      stream.getTracks().forEach((track) => track.addEventListener('ended', () => {
        if (stream === selectedStream) stopCapture('Sharing ended. Select Share audio to start again.');
      }));
      stopButton.disabled = false;
      if (stream.getTracks().some((track) => track.readyState === 'ended')) {
        stopCapture('Sharing ended. Select Share audio to start again.');
        return;
      }
      if (!selectedStream.getAudioTracks().length) {
        stopCapture('No audio was shared. Try again and enable audio in the sharing dialog, or choose a supported source.');
        return;
      }
      const source = context.createMediaStreamSource(selectedStream);
      const nextAnalyser = context.createAnalyser();
      nextAnalyser.fftSize = 2048;
      nextAnalyser.smoothingTimeConstant = 0.65;
      source.connect(nextAnalyser);
      const result = await resumed;
      if (id !== captureId) return;
      if (!result.ok) throw result.error;
      analyser = nextAnalyser;
      samples = new Uint8Array(analyser.frequencyBinCount);
      pending = false;
      status.textContent = 'Audio is being analyzed locally. Stop sharing at any time.';
    } catch (error) {
      if (id !== captureId) return;
      console.error('Unable to start audio sharing:', error);
      const message = error.name === 'NotAllowedError'
        ? 'Sharing was cancelled or denied. Select Share audio to try again.'
        : 'Could not start audio sharing. Check your browser and source, then try again.';
      stopCapture(message);
    }
  });
  stopButton.addEventListener('click', () => stopCapture('Sharing stopped. Select Share audio to start again.'));
  window.addEventListener('pagehide', () => stopCapture('Sharing stopped.'));
  document.addEventListener('visibilitychange', startAnimation);
  reduceMotion.addEventListener('change', startAnimation);
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); startAnimation(); }, 120);
  });

  resize();
  startAnimation();
})();
