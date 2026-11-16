(() => {
  'use strict';

  const music = document.getElementById('sky-music');
  const click = document.getElementById('sky-click');
  const toggle = document.getElementById('sky-sound-toggle');
  const offIcon = document.getElementById('sky-sound-off');
  const status = document.getElementById('sky-sound-status');
  const credits = document.getElementById('sky-credits');
  let enabled = true;
  let blocked = false;
  let starting = false;
  let playbackAttempt = 0;

  music.volume = 0.3;

  function updateToggle() {
    const active = enabled && !blocked;
    const label = active ? 'Mute sound' : 'Enable sound';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-pressed', String(active));
    toggle.title = label;
    offIcon.toggleAttribute('hidden', active);
  }

  function startMusic() {
    if (!enabled || starting || !music.paused) return;
    starting = true;
    const attempt = ++playbackAttempt;
    music.play().then(() => {
      if (attempt !== playbackAttempt) return;
      blocked = false;
      status.hidden = true;
      updateToggle();
    }).catch((error) => {
      if (attempt !== playbackAttempt) return;
      if (error.name === 'NotAllowedError') {
        blocked = true;
        status.textContent = 'Interact with the page to enable sound.';
      } else {
        enabled = false;
        console.error('Unable to play constellation music:', error);
        status.textContent = 'Unable to play constellation music.';
      }
      status.hidden = false;
      updateToggle();
    }).finally(() => {
      if (attempt === playbackAttempt) starting = false;
    });
  }

  function retryOnInteraction(event) {
    if (blocked && !toggle.contains(event.target)) startMusic();
  }

  toggle.addEventListener('click', () => {
    if (!enabled || blocked) {
      enabled = true;
      startMusic();
    } else {
      enabled = false;
      playbackAttempt++;
      starting = false;
      music.pause();
      status.hidden = true;
      updateToggle();
    }
  });
  document.addEventListener('pointerdown', retryOnInteraction);
  document.addEventListener('keydown', retryOnInteraction);

  function playClick() {
    click.currentTime = 0;
    click.play().catch((error) => {
      if (!enabled && error.name === 'AbortError') return;
      console.error('Unable to play constellation click sound:', error);
      status.textContent = 'Unable to play constellation click sound.';
      status.hidden = false;
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button, a.sky-home');
    if (button && (enabled || button === toggle)) playClick();
  }, true);
  window.addEventListener('constellation-panel-open', () => {
    if (enabled) playClick();
  });

  document.getElementById('sky-credits-toggle').addEventListener('click', () => credits.showModal());
  document.getElementById('sky-credits-close').addEventListener('click', () => credits.close());
  credits.addEventListener('click', (event) => {
    const rect = credits.getBoundingClientRect();
    if (event.target === credits && (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)) credits.close();
  });
  credits.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') event.stopPropagation();
  });

  startMusic();
})();
