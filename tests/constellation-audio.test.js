const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'constellation_audio.js'), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(playMusic) {
  const listeners = new Map();
  const attributes = new Map();
  const errors = [];
  const music = {
    paused: true,
    plays: 0,
    play() {
      this.plays++;
      if (playMusic) return playMusic(this);
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; }
  };
  const click = {
    plays: 0,
    currentTime: 1,
    play() { this.plays++; return Promise.resolve(); },
    pause() {}
  };
  const toggle = {
    addEventListener(type, handler) { listeners.set(`toggle:${type}`, handler); },
    setAttribute(name, value) { attributes.set(name, value); },
    contains(target) { return target === this; }
  };
  const icon = { toggleAttribute(name, force) { attributes.set(`icon:${name}`, force); } };
  const status = { hidden: true, textContent: '' };
  const credits = {
    open: false,
    addEventListener(type, handler) { listeners.set(`credits:${type}`, handler); },
    showModal() { this.open = true; },
    close() { this.open = false; },
    getBoundingClientRect() { return { left: 10, right: 100, top: 20, bottom: 80 }; }
  };
  const creditsToggle = { addEventListener(type, handler) { listeners.set(`credits-toggle:${type}`, handler); } };
  const creditsClose = { addEventListener(type, handler) { listeners.set(`credits-close:${type}`, handler); } };
  const elements = {
    'sky-music': music, 'sky-click': click, 'sky-sound-toggle': toggle, 'sky-sound-off': icon, 'sky-sound-status': status,
    'sky-credits': credits, 'sky-credits-toggle': creditsToggle, 'sky-credits-close': creditsClose
  };
  const document = {
    getElementById(id) { return elements[id]; },
    addEventListener(type, handler) { listeners.set(`document:${type}`, handler); }
  };
  const window = { addEventListener(type, handler) { listeners.set(`window:${type}`, handler); } };
  vm.runInNewContext(source, { document, window, console: { error(...args) { errors.push(args); } } });
  return { music, click, toggle, credits, status, attributes, errors, listeners };
}

test('panel openings play one click and the toggle mutes and restores both sounds', async () => {
  const { music, click, status, attributes, listeners } = setup();
  await flush();
  assert.equal(music.plays, 1);
  assert.equal(music.volume, 0.3);
  assert.equal(attributes.get('aria-pressed'), 'true');
  listeners.get('window:constellation-panel-open')();
  assert.equal(click.plays, 1);
  assert.equal(click.currentTime, 0);
  click.currentTime = 0.5;
  listeners.get('window:constellation-panel-open')();
  assert.equal(click.plays, 2);
  assert.equal(click.currentTime, 0);
  listeners.get('toggle:click')();
  assert.equal(music.paused, true);
  assert.equal(attributes.get('aria-pressed'), 'false');
  assert.equal(attributes.get('icon:hidden'), false);
  listeners.get('window:constellation-panel-open')();
  assert.equal(click.plays, 2);
  listeners.get('toggle:click')();
  await flush();
  assert.equal(music.plays, 2);
  assert.equal(attributes.get('aria-pressed'), 'true');
  assert.equal(status.hidden, true);
});

test('blocked autoplay prompts and retries on a user interaction', async () => {
  const state = setup((music) => {
    if (music.plays === 1) return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    music.paused = false;
    return Promise.resolve();
  });
  await flush();
  assert.equal(state.attributes.get('aria-label'), 'Enable sound');
  assert.equal(state.status.hidden, false);
  state.listeners.get('document:pointerdown')({ target: {} });
  await flush();
  assert.equal(state.music.plays, 2);
  assert.equal(state.status.hidden, true);
  assert.equal(state.attributes.get('aria-pressed'), 'true');
});

test('an interrupted startup cannot override a newer sound setting', async () => {
  let rejectFirst;
  const state = setup((music) => {
    if (music.plays === 1) return new Promise((resolve, reject) => { rejectFirst = reject; });
    music.paused = false;
    return Promise.resolve();
  });
  state.listeners.get('toggle:click')();
  state.listeners.get('toggle:click')();
  rejectFirst(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
  await flush();
  assert.equal(state.music.plays, 2);
  assert.equal(state.music.paused, false);
  assert.equal(state.attributes.get('aria-pressed'), 'true');
  assert.equal(state.errors.length, 0);
});

test('a music playback failure is reported and can be retried', async () => {
  const state = setup((music) => {
    if (music.plays === 1) return Promise.reject(new Error('unsupported audio'));
    music.paused = false;
    return Promise.resolve();
  });
  await flush();
  assert.equal(state.errors.length, 1);
  assert.equal(state.status.textContent, 'Unable to play constellation music.');
  assert.equal(state.status.hidden, false);
  assert.equal(state.attributes.get('aria-label'), 'Enable sound');
  state.listeners.get('toggle:click')();
  await flush();
  assert.equal(state.music.plays, 2);
  assert.equal(state.status.hidden, true);
});

test('button clicks play once and respect the sound toggle', async () => {
  const state = setup();
  await flush();
  const button = {};
  const dispatch = (target) => state.listeners.get('document:click')({ target: { closest: () => target } });
  dispatch(button);
  assert.equal(state.click.plays, 1);
  dispatch(null);
  assert.equal(state.click.plays, 1);
  dispatch(state.toggle);
  state.listeners.get('toggle:click')();
  assert.equal(state.click.plays, 2);
  dispatch(button);
  assert.equal(state.click.plays, 2);
  dispatch(state.toggle);
  state.listeners.get('toggle:click')();
  await flush();
  assert.equal(state.click.plays, 3);
  dispatch(button);
  assert.equal(state.click.plays, 4);
});

test('credits close on the close button or an outside click, not inside clicks', () => {
  const state = setup();
  state.listeners.get('credits-toggle:click')();
  assert.equal(state.credits.open, true);
  state.listeners.get('credits:click')({ target: state.credits, clientX: 50, clientY: 50 });
  assert.equal(state.credits.open, true);
  state.listeners.get('credits:click')({ target: state.credits, clientX: 5, clientY: 50 });
  assert.equal(state.credits.open, false);
  state.listeners.get('credits-toggle:click')();
  state.listeners.get('credits-close:click')();
  assert.equal(state.credits.open, false);
});
