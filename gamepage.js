const viewport = document.getElementById("carouselViewport");
const track = document.getElementById("carouselTrack");
const status = document.getElementById("carouselStatus");
const hint = document.getElementById("carouselHint");
const details = document.getElementById("gameDetails");
const detailsTitle = document.getElementById("detailsTitle");
const detailsDescription = document.getElementById("detailsDescription");
const closeDetails = document.getElementById("closeDetails");
const playLink = document.getElementById("playLink");
const gameGrid = document.getElementById("gameGrid");
const pageError = document.getElementById("pageError");
const backgroundSections = document.querySelectorAll("body > header, body > main, body > footer");
const games = window.GAME_DATA;

function isValidGame(game) {
  if (!game || typeof game.title !== "string" || !game.title ||
      typeof game.banner !== "string" || !game.banner ||
      typeof game.bannerAlt !== "string" || !game.bannerAlt ||
      typeof game.bannerPosition !== "string" || !game.bannerPosition ||
      typeof game.shortDescription !== "string" || typeof game.description !== "string" ||
      !game.palette || !["background", "glow", "accent"].every((key) =>
        typeof game.palette[key] === "string" && CSS.supports("color", game.palette[key])) ||
      !Array.isArray(game.images) || !game.images.every((image) =>
        image && typeof image.src === "string" && typeof image.alt === "string" && image.alt) ||
      typeof game.playUrl !== "string" || typeof game.playUrlIsPlaceholder !== "boolean") {
    return false;
  }

  try {
    return ["http:", "https:"].includes(new URL(game.playUrl).protocol);
  } catch (error) {
    return false;
  }
}

if (!Array.isArray(games) || !games.length || !games.every(isValidGame)) {
  console.error("Unable to load games: check the entries in game-data.js.");
  pageError.textContent = "The games could not be loaded. Check the game data and try again.";
  pageError.hidden = false;
} else {
  startGamePage(games);
}

function startGamePage(gameData) {
  const cards = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = 0;
  let scrollFrame = 0;
  let centeringFrame = 0;
  let hintTimer = 0;
  let pointerStartX = 0;
  let pointerStartScroll = 0;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let dragVelocity = 0;
  let pointerId = null;
  let dragging = false;
  let suppressClick = false;

  gameData.forEach((game, index) => {
    const card = document.createElement("button");
    card.className = "game-card";
    card.type = "button";
    card.setAttribute("aria-controls", "gameDetails");
    card.setAttribute("aria-expanded", "false");

    const image = document.createElement("img");
    image.src = game.banner;
    image.alt = game.bannerAlt;
    image.style.objectPosition = game.bannerPosition;
    image.draggable = false;

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = game.title;
    const description = document.createElement("span");
    description.className = "card-description";
    description.textContent = game.shortDescription;
    card.append(image, title, description);
    card.addEventListener("click", () => {
      setActive(index);
      centerCard(index, false);
      details.hidden = false;
      details.scrollTop = 0;
      backgroundSections.forEach((section) => { section.inert = true; });
      document.body.classList.add("has-open-details");
      updateDetails();
      updateExpandedState();
      closeDetails.focus();
    });
    cards.push(card);
    track.append(card);
  });

  function updateExpandedState() {
    cards.forEach((card, index) => {
      card.setAttribute("aria-expanded", String(!details.hidden && index === activeIndex));
    });
  }

  function updateDetails() {
    const game = gameData[activeIndex];
    detailsTitle.textContent = game.title;
    detailsDescription.textContent = game.description;
    playLink.href = game.playUrl;
    playLink.textContent = game.playUrlIsPlaceholder ? "Play (placeholder link)" : "Play game";
    gameGrid.replaceChildren();
    game.images.forEach((image) => {
      if (image.src) {
        const element = document.createElement("img");
        element.src = image.src;
        element.alt = image.alt;
        element.loading = "lazy";
        gameGrid.append(element);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "image-placeholder";
        placeholder.textContent = image.alt;
        gameGrid.append(placeholder);
      }
    });
  }

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(index, gameData.length - 1));
    const game = gameData[activeIndex];
    document.documentElement.style.setProperty("--background", game.palette.background);
    document.documentElement.style.setProperty("--glow", game.palette.glow);
    document.documentElement.style.setProperty("--accent", game.palette.accent);
    status.textContent = `${activeIndex + 1} / ${gameData.length}: ${game.title}`;
    if (!details.hidden) {
      updateDetails();
    }
    updateExpandedState();
  }

  function nearestCardIndex(scrollOffset = 0) {
    const center = viewport.getBoundingClientRect().left + viewport.clientWidth / 2 + scrollOffset;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    cards.forEach((card, index) => {
      const bounds = card.getBoundingClientRect();
      const distance = Math.abs(bounds.left + bounds.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  function centerCard(index, animate = true) {
    cancelAnimationFrame(centeringFrame);
    const viewportBounds = viewport.getBoundingClientRect();
    const cardBounds = cards[index].getBoundingClientRect();
    const start = viewport.scrollLeft;
    const left = start + cardBounds.left + cardBounds.width / 2 -
      viewportBounds.left - viewport.clientWidth / 2;
    if (!animate || reducedMotion.matches || Math.abs(left - start) < 1) {
      viewport.scrollLeft = left;
      viewport.classList.remove("is-centering");
      return;
    }

    viewport.classList.add("is-centering");
    const duration = Math.min(750, Math.max(350, Math.abs(left - start) * 0.6));
    const started = performance.now();
    function step(now) {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      viewport.scrollLeft = start + (left - start) * eased;
      if (progress < 1) {
        centeringFrame = requestAnimationFrame(step);
      } else {
        centeringFrame = 0;
        viewport.classList.remove("is-centering");
      }
    }
    centeringFrame = requestAnimationFrame(step);
  }

  function showHintWhenIdle() {
    hint.classList.add("is-browsing");
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      hint.classList.remove("is-browsing");
    }, 1200);
  }

  function move(direction) {
    const index = Math.max(0, Math.min(activeIndex + direction, gameData.length - 1));
    setActive(index);
    centerCard(index);
  }

  closeDetails.addEventListener("click", () => {
    details.hidden = true;
    backgroundSections.forEach((section) => { section.inert = false; });
    document.body.classList.remove("has-open-details");
    updateExpandedState();
    cards[activeIndex].focus({ preventScroll: true });
  });

  let backdropPressed = false;
  details.addEventListener("pointerdown", (event) => {
    backdropPressed = event.target === details;
  });
  details.addEventListener("pointercancel", () => {
    backdropPressed = false;
  });
  details.addEventListener("click", (event) => {
    if (backdropPressed && event.target === details) {
      closeDetails.click();
    }
    backdropPressed = false;
  });

  details.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDetails.click();
    } else if (event.key === "Tab") {
      if (event.shiftKey && document.activeElement === closeDetails) {
        event.preventDefault();
        playLink.focus();
      } else if (!event.shiftKey && document.activeElement === playLink) {
        event.preventDefault();
        closeDetails.focus();
      }
    }
  });

  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  viewport.addEventListener("scroll", () => {
    showHintWhenIdle();
    if (!scrollFrame) {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const index = nearestCardIndex();
        if (details.hidden && index !== activeIndex) {
          setActive(index);
        }
      });
    }
  }, { passive: true });

  viewport.addEventListener("pointerdown", (event) => {
    suppressClick = false;
    cancelAnimationFrame(centeringFrame);
    centeringFrame = 0;
    if (event.pointerType !== "mouse" || event.button !== 0) {
      viewport.classList.remove("is-centering");
      return;
    }
    viewport.classList.add("is-centering");
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartScroll = viewport.scrollLeft;
    lastPointerX = event.clientX;
    lastPointerTime = performance.now();
    dragVelocity = 0;
    dragging = false;
    showHintWhenIdle();
  });
  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }
    const distance = event.clientX - pointerStartX;
    if (!dragging && Math.abs(distance) > 4) {
      dragging = true;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(event.pointerId);
    }
    if (dragging) {
      viewport.scrollLeft = pointerStartScroll - distance;
      const now = performance.now();
      const elapsed = Math.max(1, now - lastPointerTime);
      const velocity = -(event.clientX - lastPointerX) / elapsed;
      dragVelocity = dragVelocity * 0.65 + velocity * 0.35;
      lastPointerX = event.clientX;
      lastPointerTime = now;
    }
  });

  function endDrag(event) {
    if (event.pointerId !== pointerId) {
      return;
    }
    pointerId = null;
    if (dragging) {
      suppressClick = event.type === "pointerup";
      dragging = false;
      viewport.classList.remove("is-dragging");
      const recentVelocity = performance.now() - lastPointerTime < 100 ? dragVelocity : 0;
      const projection = reducedMotion.matches ? 0 : Math.max(-viewport.clientWidth, Math.min(viewport.clientWidth, recentVelocity * 200));
      const index = nearestCardIndex(projection);
      setActive(index);
      centerCard(index);
    } else {
      viewport.classList.remove("is-centering");
    }
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("click", (event) => {
    if (suppressClick && event.detail !== 0) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }, true);
  window.addEventListener("resize", () => centerCard(activeIndex, false));

  setActive(0);
  centerCard(0, false);
}
