(() => {
  const sections = {
    games: 'Games',
    art: 'Art',
    ar: 'AR',
    vr: 'VR',
    prototype: 'Prototype'
  };
  const section = new URLSearchParams(window.location.search).get('section');
  if (!Object.hasOwn(sections, section)) return;

  const title = document.getElementById('placeholder-title');
  title.firstChild.textContent = sections[section];
  document.title = `${sections[section]} placeholder | Felipe Gomes`;
})();
