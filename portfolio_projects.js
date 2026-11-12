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
    },
    'financial-app': {
      name: 'Financial App',
      description: 'I wanted a simpler way to keep track of my expenses without spending so much time working with spreadsheets, so I decided to build my own solution.\n\nThis project is a personal expense tracking app developed as a Progressive Web App (PWA), meaning it can be installed and used on both mobile and desktop devices.\n\nThe idea was to create something simple, practical, and tailored to my needs, with all the features I actually use to manage my personal finances.',
      techStack: 'TypeScript, React, PostgreSQL, Supabase and Vercel.',
      liveDemoUrl: 'https://finance-tracker-git-guest-felipegmls-projects.vercel.app/',
      note: 'Note: This demo has no login or database connection. All data is stored locally and will be lost if the browser cache is cleared.',
      images: [
        { thumb: 'assets/apps/finance/overview.png', full: 'assets/apps/finance/overview.png', alt: 'Financial tracker overview with balances, charts, and recent activity' },
        { thumb: 'assets/apps/finance/wallets.png', full: 'assets/apps/finance/wallets.png', alt: 'Financial tracker wallets showing account balances' },
        { thumb: 'assets/apps/finance/transaction.png', full: 'assets/apps/finance/transaction.png', alt: 'Financial tracker transactions with filters and recent entries' },
        { thumb: 'assets/apps/finance/category.png', full: 'assets/apps/finance/category.png', alt: 'Financial tracker categories for organizing transactions and wallets' }
      ]
    }
  };
  const name = document.getElementById('project-name');
  const description = document.getElementById('project-description');
  const player = document.getElementById('project-player');
  const layout = document.querySelector('.project-layout');
  const copy = document.querySelector('.project-copy');
  const video = document.querySelector('.project-video');
  const gallery = document.querySelector('.project-gallery');
  const imageGrid = document.getElementById('project-image-grid');
  const imageDialog = document.getElementById('project-image-dialog');
  const dialogImage = document.getElementById('project-dialog-image');
  let lastImageButton;

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

  function showImages(images) {
    imageGrid.replaceChildren();
    for (const image of images) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Open ${image.alt}`);
      const thumbnail = document.createElement('img');
      thumbnail.src = image.thumb;
      thumbnail.alt = image.alt;
      button.append(thumbnail);
      button.addEventListener('click', () => {
        lastImageButton = button;
        dialogImage.src = image.full;
        dialogImage.alt = image.alt;
        imageDialog.showModal();
      });
      imageGrid.append(button);
    }
  }

  function renderDescription(project) {
    if (!project.techStack && !project.liveDemoUrl && !project.note) {
      description.textContent = project.description;
      return;
    }

    description.replaceChildren();
    for (const paragraphText of project.description.split('\n\n')) {
      const paragraph = document.createElement('p');
      paragraph.textContent = paragraphText;
      description.append(paragraph);
    }

    const techStack = document.createElement('p');
    const techLabel = document.createElement('strong');
    techLabel.textContent = 'Tech Stack: ';
    techStack.append(techLabel, project.techStack);
    description.append(techStack);

    const liveDemo = document.createElement('p');
    const demoLink = document.createElement('a');
    demoLink.href = project.liveDemoUrl;
    demoLink.target = '_blank';
    demoLink.rel = 'noopener noreferrer';
    demoLink.textContent = 'Live Demo';
    const demoLabel = document.createElement('strong');
    demoLabel.append(demoLink, ':');
    liveDemo.append(demoLabel);
    description.append(liveDemo);

    const note = document.createElement('p');
    const emphasis = document.createElement('em');
    emphasis.textContent = project.note;
    note.append(emphasis);
    description.append(note);
  }

  imageDialog.querySelector('button').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', (event) => {
    if (event.target === imageDialog) imageDialog.close();
  });
  imageDialog.addEventListener('close', () => {
    if (lastImageButton && lastImageButton.isConnected && !gallery.hidden) lastImageButton.focus();
  });

  window.addEventListener('portfolio-section-change', (event) => {
    if (imageDialog.open) imageDialog.close();
    resetPlayer();
    const currentProject = Object.hasOwn(projects, event.detail) ? projects[event.detail] : null;
    if (!currentProject) return;
    name.textContent = currentProject.name;
    renderDescription(currentProject);
    copy.hidden = !currentProject.description;
    video.hidden = !!currentProject.images;
    gallery.hidden = !currentProject.images;
    layout.classList.toggle('gallery-only', !currentProject.description && !!currentProject.images);
    if (currentProject.images) showImages(currentProject.images);
    if (currentProject.videoUrl) loadVideo(currentProject);
  });
})();
