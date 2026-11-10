(() => {
  const toggle = document.querySelector('.node-toggle');
  const children = document.getElementById('project-nodes');
  const home = document.querySelector('.portfolio-content');
  const sectionView = document.getElementById('section-view');
  const sectionName = document.getElementById('section-name');
  const sectionTitle = document.getElementById('section-title');
  const sections = {
    games: 'Games',
    art: 'Art',
    ar: 'AR',
    vr: 'VR',
    prototype: 'Prototype'
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let transitionTimer;

  children.inert = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    children.inert = expanded;
  });

  function showCurrentSection(animate) {
    clearTimeout(transitionTimer);
    const key = window.location.hash.slice(1);
    const name = Object.hasOwn(sections, key) ? sections[key] : null;
    const outgoing = home.hidden ? sectionView : home;
    const incoming = name ? sectionView : home;

    function show() {
      outgoing.classList.remove('view-leaving', 'view-entering');
      outgoing.inert = false;
      home.hidden = Boolean(name);
      sectionView.hidden = !name;
      if (name) sectionName.textContent = name;
      document.title = name ? `${name} placeholder | Felipe Gomes` : 'Felipe Gomes | Portfolio example';
      if (animate) {
        incoming.classList.remove('view-entering');
        void incoming.offsetWidth;
        incoming.classList.add('view-entering');
        window.scrollTo(0, 0);
        if (name) sectionTitle.focus({ preventScroll: true });
        else home.querySelector('h1').focus({ preventScroll: true });
      }
    }

    if (!animate || reducedMotion.matches) {
      show();
      return;
    }
    outgoing.classList.remove('view-entering');
    outgoing.classList.add('view-leaving');
    outgoing.inert = true;
    transitionTimer = setTimeout(show, 160);
  }

  home.querySelector('h1').tabIndex = -1;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-section], a[data-home]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href);
    if (link.dataset.section) {
      const placeholder = new URL('portfolio_placeholder.html', window.location.href);
      if (destination.origin !== placeholder.origin || destination.pathname !== placeholder.pathname ||
          destination.searchParams.get('section') !== link.dataset.section) return;
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
