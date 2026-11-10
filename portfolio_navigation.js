(() => {
  const toggle = document.querySelector('.node-toggle');
  const children = document.getElementById('project-nodes');
  const home = document.querySelector('.portfolio-content');
  const sectionView = document.getElementById('section-view');
  const sectionName = document.getElementById('section-name');
  const sectionTitle = document.getElementById('section-title');
  const gamesView = document.getElementById('games-view');
  const gamesTitle = document.getElementById('games-title');
  const projectView = document.getElementById('project-view');
  const projectTitle = document.getElementById('project-title');
  const sections = {
    games: 'Games',
    art: 'Art',
    ar: 'Augmented Reality',
    vr: 'Virtual Reality',
    prototype: 'Prototype'
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let transitionTimer;
  let cleanupTimer;
  const wrappedText = new WeakMap();

  function prepareGlitch(view) {
    const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      if (/\S/.test(walker.currentNode.nodeValue) && !walker.currentNode.parentElement.closest('.carousel-section, .project-video')) {
        textNodes.push(walker.currentNode);
      }
    }
    let index = 0;
    const wrapped = textNodes.map((node) => {
      const original = node.nodeValue;
      const accessible = document.createElement('span');
      accessible.className = 'screen-reader-text';
      accessible.textContent = original;
      const visual = document.createElement('span');
      visual.className = 'glitch-text';
      visual.setAttribute('aria-hidden', 'true');
      for (const character of Array.from(original)) {
        if (/\s/.test(character)) {
          visual.append(document.createTextNode(character));
        } else {
          const letter = document.createElement('span');
          letter.className = 'glitch-char';
          letter.style.setProperty('--glitch-delay', `${(index++ * 73) % 200}ms`);
          letter.textContent = character;
          visual.append(letter);
        }
      }
      node.replaceWith(accessible, visual);
      return { accessible, visual, original };
    });
    wrappedText.set(view, wrapped);
  }

  function clearGlitch(view) {
    const wrapped = wrappedText.get(view) || [];
    for (const { accessible, visual, original } of wrapped) {
      accessible.replaceWith(document.createTextNode(original));
      visual.remove();
    }
    wrappedText.delete(view);
    view.classList.remove('view-leaving', 'view-entering');
    view.inert = false;
  }

  children.inert = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    children.inert = expanded;
  });

  function showCurrentSection(animate) {
    clearTimeout(transitionTimer);
    clearTimeout(cleanupTimer);
    clearGlitch(home);
    clearGlitch(sectionView);
    clearGlitch(gamesView);
    clearGlitch(projectView);
    const key = window.location.hash.slice(1);
    const name = Object.hasOwn(sections, key) ? sections[key] : null;
    const outgoing = [home, gamesView, projectView, sectionView].find((view) => !view.hidden);
    const incoming = key === 'games' ? gamesView : key === 'ar' || key === 'vr' ? projectView : name ? sectionView : home;

    function show() {
      clearGlitch(outgoing);
      window.dispatchEvent(new CustomEvent('portfolio-section-change', { detail: key }));
      home.hidden = incoming !== home;
      sectionView.hidden = incoming !== sectionView;
      gamesView.hidden = incoming !== gamesView;
      projectView.hidden = incoming !== projectView;
      if (incoming === sectionView) sectionName.textContent = name;
      document.title = incoming === gamesView || incoming === projectView ? `Felipe Gomes | ${name}` : name ? `${name} placeholder | Felipe Gomes` : 'Felipe Gomes | Portfolio example';
      if (animate) {
        if (!reducedMotion.matches) {
          prepareGlitch(incoming);
          incoming.classList.add('view-entering');
          cleanupTimer = setTimeout(() => clearGlitch(incoming), 420);
        }
        window.scrollTo(0, 0);
        if (key === 'games') gamesTitle.focus({ preventScroll: true });
        else if (incoming === projectView) projectTitle.focus({ preventScroll: true });
        else if (name) sectionTitle.focus({ preventScroll: true });
        else home.querySelector('h1').focus({ preventScroll: true });
      }
    }

    if (!animate || reducedMotion.matches) {
      show();
      return;
    }
    prepareGlitch(outgoing);
    outgoing.classList.add('view-leaving');
    outgoing.inert = true;
    transitionTimer = setTimeout(show, 420);
  }

  home.querySelector('h1').tabIndex = -1;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-section], a[data-home]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href);
    if (link.dataset.section) {
      const expected = new URL(link.dataset.section === 'games' ? 'gamepage.html' : 'portfolio_placeholder.html', window.location.href);
      if (destination.origin !== expected.origin || destination.pathname !== expected.pathname ||
          (link.dataset.section !== 'games' && destination.searchParams.get('section') !== link.dataset.section) ||
          (link.dataset.section === 'games' && destination.search)) return;
    } else if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname) {
      return;
    }
    event.preventDefault();
    const hash = link.dataset.section ? `#${link.dataset.section}` : window.location.pathname + window.location.search;
    window.history.pushState(null, '', hash);
    showCurrentSection(true);
  });
  window.addEventListener('popstate', () => showCurrentSection(true));
  showCurrentSection(false);
})();
