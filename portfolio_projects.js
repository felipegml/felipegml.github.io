(() => {
  const projects = {
    ar: {
      name: 'Augmented Reality',
      description: 'A collection of augmented reality projects exploring new ways to blend digital experiences with the physical world.\n\nFrom interactive brand activations and immersive experiences to creative AR experiments, these projects bring ideas to life through technology, design, and innovation.\n\nCreated for brands including LG, Claro, Heineken, Globo, and others.',
      videoUrl: 'https://www.youtube.com/watch?v=HvNf1Pdw5Ro'
    },
    vr: {
      name: 'Virtual Reality',
      description: "A collection of virtual reality projects exploring immersive worlds, interactive storytelling, and shared experiences.\n\nFrom multiplayer environments and collaborative experiences to immersive brand activations and virtual worlds, these projects push the boundaries of how people connect, play, and experience digital spaces.\n\nProjects for Sebrae and Claro, as well as a VR experience for Netflix's Stranger Things series.",
      videoUrl: 'https://www.youtube.com/watch?v=MzHEDac4kD8'
    }
  };
  const name = document.getElementById('project-name');
  const description = document.getElementById('project-description');
  const player = document.getElementById('project-player');

  function videoId(value) {
    let url;
    try {
      url = new URL(value);
    } catch (exception) {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    let id = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (/^\/(embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  function resetPlayer() {
    const message = document.createElement('p');
    message.textContent = 'Project video not yet available.';
    player.replaceChildren(message);
  }

  function loadVideo(project) {
    const id = videoId(project.videoUrl);
    if (!id) {
      console.error(`Invalid YouTube video URL for ${project.name}.`);
      player.querySelector('p').textContent = 'Project video could not be loaded.';
      return;
    }
    if (window.location.protocol === 'file:') {
      const link = document.createElement('a');
      link.className = 'video-fallback';
      link.href = `https://www.youtube.com/watch?v=${id}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const image = document.createElement('img');
      image.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      image.alt = '';
      const label = document.createElement('span');
      label.textContent = `Watch ${project.name} video on YouTube`;
      link.append(image, label);
      player.replaceChildren(link);
      return;
    }
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${id}`;
    frame.title = `${project.name} project video`;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    player.replaceChildren(frame);
  }

  window.addEventListener('portfolio-section-change', (event) => {
    resetPlayer();
    const currentProject = Object.hasOwn(projects, event.detail) ? projects[event.detail] : null;
    if (!currentProject) return;
    name.textContent = currentProject.name;
    description.textContent = currentProject.description;
    if (currentProject.videoUrl) loadVideo(currentProject);
  });
})();
