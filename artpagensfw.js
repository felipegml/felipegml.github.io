const developerMode = location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const portrait = window.matchMedia("(orientation: portrait) and (max-width: 900px), (orientation: portrait) and (pointer: coarse)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const galleryError = document.getElementById("galleryError");
const bookArea = document.getElementById("bookArea");
const gridViewport = document.getElementById("gridViewport");
const viewToggle = document.getElementById("viewToggle");
const imageDialog = document.getElementById("imageDialog");

document.addEventListener("contextmenu", (event) => event.preventDefault());

function updateOrientation() {
  if (portrait.matches && imageDialog.open) imageDialog.close();
  document.querySelector(".gallery").inert = portrait.matches;
  document.querySelector(".home-link").inert = portrait.matches;
  viewToggle.inert = portrait.matches;
}
portrait.addEventListener("change", updateOrientation);
updateOrientation();

function validateThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new TypeError("Theme manifest must be a non-empty array.");
  }
  themes.forEach((theme, themeIndex) => {
    if (!theme || typeof theme.title !== "string" || !theme.title.trim() || !Array.isArray(theme.artworks) || theme.artworks.length === 0) {
      throw new TypeError(`Theme at index ${themeIndex} must include a title and a non-empty artworks array.`);
    }
    theme.artworks.forEach((artwork, artworkIndex) => {
      if (!artwork || ["title", "alt", "description", "thumb", "full"].some((key) => typeof artwork[key] !== "string" || !artwork[key].trim())) {
        throw new TypeError(`Artwork at index ${artworkIndex} in theme ${themeIndex} must include title, alt, description, thumb, and full strings.`);
      }
    });
  });
  return themes;
}

function loadThemes() {
  if (developerMode) return Promise.resolve(window.INTERNAL_NSFW_THEMES);
  return fetch(new URL("artworks-nsfw.json", location.href)).then((response) => {
    if (!response.ok) throw new Error(`Artwork manifest request failed with status ${response.status}.`);
    return response.json();
  });
}

function startGallery(themes) {
  const artworks = themes.flatMap((theme) => theme.artworks);
  let firstArtwork = 0;
  const themeEntries = themes.map((theme) => {
    const entry = { title: theme.title, firstArtwork };
    firstArtwork += theme.artworks.length;
    return entry;
  });
  const backPosition = artworks.length + 2;
  const book = document.getElementById("book");
  const leftPage = document.getElementById("leftPage");
  const rightPage = document.getElementById("rightPage");
  const turningPage = document.getElementById("turningPage");
  const turningFront = document.getElementById("turningFront");
  const turningBack = document.getElementById("turningBack");
  const previous = document.getElementById("previousPage");
  const next = document.getElementById("nextPage");
  const contentsButton = document.getElementById("contentsButton");
  const status = document.getElementById("bookStatus");
  const grid = document.getElementById("artGrid");
  const modalImage = document.getElementById("modalImage");
  const modalError = document.getElementById("modalError");
  let position = 0;
  let activeArtwork = 0;
  let isTurning = false;
  let isGrid = false;
  let lastOpenedCard = null;
  let dragStart = null;
  let suppressClickUntil = 0;
  let bookGesture = null;
  let suppressBookClickUntil = 0;
  let inertiaFrame = 0;

  function makePage(kind, index, interactive = true) {
    const page = document.createElement("div");
    page.className = "page-content";
    if (kind === "front" || kind === "back") {
      page.classList.add("cover");
      if (kind === "front") {
        const title = document.createElement("span");
        title.className = "cover-title";
        title.textContent = "Secret\nGallery";
        page.append(title);
      } else {
        const signature = document.createElement("img");
        signature.className = "cover-signature";
        signature.src = window.SIGNATURE_DATA_URL;
        signature.alt = "Artist signature";
        page.append(signature);
      }
    } else if (kind === "index-heading") {
      page.classList.add("index-heading");
      const title = document.createElement("h2");
      const introduction = document.createElement("p");
      title.textContent = "Contents";
      introduction.textContent = "Choose a theme to explore.";
      page.append(title, introduction);
    } else if (kind === "index-list") {
      page.classList.add("index-list");
      themeEntries.forEach((theme) => {
        const button = document.createElement("button");
        const label = document.createElement("span");
        const number = document.createElement("span");
        button.className = "theme-button";
        button.type = "button";
        button.tabIndex = interactive ? 0 : -1;
        label.textContent = theme.title;
        number.className = "theme-number";
        number.textContent = String(theme.firstArtwork + 1);
        number.setAttribute("aria-hidden", "true");
        button.append(label, number);
        if (interactive) button.addEventListener("click", () => {
          if (isTurning) return;
          position = theme.firstArtwork + 2;
          renderBook();
          rightPage.querySelector(".art-button").focus({ preventScroll: true });
        });
        page.append(button);
      });
    } else if (kind === "description") {
      page.classList.add("description-page");
      if (interactive) page.tabIndex = 0;
      const title = document.createElement("h2");
      const description = document.createElement("p");
      title.textContent = artworks[index].title;
      description.textContent = artworks[index].description;
      page.append(title, description);
    } else {
      page.classList.add("image-page");
      const button = document.createElement("button");
      const image = document.createElement("img");
      button.className = "art-button";
      button.type = "button";
      button.setAttribute("aria-label", `View ${artworks[index].title}`);
      button.tabIndex = interactive ? 0 : -1;
      image.src = artworks[index].thumb;
      image.alt = "";
      image.addEventListener("error", () => {
        button.textContent = `Unable to load ${artworks[index].title}. Select to open the full image.`;
        button.classList.add("image-error");
        console.error(`Unable to load artwork thumbnail: ${artworks[index].thumb}`);
      });
      button.append(image);
      if (interactive) button.addEventListener("click", () => {
        if (!isTurning) openArtwork(index, button);
      });
      page.append(button);
    }
    return page;
  }

  function makeLeftPage(pagePosition, interactive = true) {
    if (pagePosition === 0) return null;
    if (pagePosition === 1) return makePage("index-heading", 0, interactive);
    if (pagePosition === backPosition) return makePage("back", 0, interactive);
    return makePage("description", pagePosition - 2, interactive);
  }

  function makeRightPage(pagePosition, interactive = true) {
    if (pagePosition === 0) return makePage("front", 0, interactive);
    if (pagePosition === 1) return makePage("index-list", 0, interactive);
    if (pagePosition === backPosition) return null;
    return makePage("image", pagePosition - 2, interactive);
  }

  function setPage(container, content) {
    container.classList.toggle("is-empty", !content);
    container.replaceChildren(...(content ? [content] : []));
  }

  function renderBook() {
    const front = position === 0;
    const back = position === backPosition;
    book.classList.toggle("is-front-cover", front);
    book.classList.toggle("is-back-cover", back);
    setPage(leftPage, makeLeftPage(position));
    setPage(rightPage, makeRightPage(position));
    status.textContent = front ? "Front cover" : back ? "Back cover" : position === 1
      ? "Contents"
      : artworks[position - 2].title;
    const focusedControl = document.activeElement;
    previous.disabled = front;
    next.disabled = back;
    contentsButton.disabled = position === 1;
    if (focusedControl === previous && front) next.focus({ preventScroll: true });
    if (focusedControl === next && back) previous.focus({ preventScroll: true });
  }

  function turn(direction) {
    const destination = position + direction;
    if (isTurning || destination < 0 || destination > backPosition) return;
    if (reducedMotion.matches) {
      position = destination;
      renderBook();
      return;
    }
    isTurning = true;
    book.classList.add("is-turning");
    const forward = direction > 0;
    const source = position;
    const frontPosition = forward ? position : destination;
    const reversePosition = forward ? destination : position;
    turningFront.replaceChildren(makeRightPage(frontPosition, false));
    turningBack.replaceChildren(makeLeftPage(reversePosition, false));
    turningPage.classList.remove("is-turning");
    turningPage.style.transform = forward ? "rotateY(0deg)" : "rotateY(-180deg)";
    turningPage.classList.add("is-visible");
    position = destination;
    renderBook();
    if (forward) {
      setPage(leftPage, makeLeftPage(source, false));
    } else {
      setPage(rightPage, makeRightPage(source, false));
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      turningPage.classList.add("is-turning");
      turningPage.style.transform = forward ? "rotateY(-180deg)" : "rotateY(0deg)";
      window.setTimeout(() => {
        turningPage.classList.remove("is-turning", "is-visible");
        turningFront.replaceChildren();
        turningBack.replaceChildren();
        isTurning = false;
        book.classList.remove("is-turning");
        renderBook();
      }, 650);
    }));
  }

  function showArtwork() {
    const artwork = artworks[activeArtwork];
    modalError.hidden = true;
    modalImage.alt = artwork.alt;
    modalImage.src = artwork.full;
    position = activeArtwork + 2;
    renderBook();
  }

  function openArtwork(index, card) {
    activeArtwork = index;
    lastOpenedCard = card;
    showArtwork();
    imageDialog.showModal();
  }

  function changeArtwork(direction) {
    activeArtwork = (activeArtwork + direction + artworks.length) % artworks.length;
    showArtwork();
  }

  artworks.forEach((artwork, index) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    button.className = "grid-card";
    button.type = "button";
    button.setAttribute("aria-label", `View ${artwork.title}`);
    image.src = artwork.thumb;
    image.alt = "";
    image.addEventListener("error", () => {
      button.textContent = `Unable to load ${artwork.title}. Select to open the full image.`;
      button.classList.add("image-error");
      console.error(`Unable to load artwork thumbnail: ${artwork.thumb}`);
    });
    button.append(image);
    button.addEventListener("click", () => {
      if (performance.now() >= suppressClickUntil) openArtwork(index, button);
    });
    grid.append(button);
  });

  previous.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  contentsButton.addEventListener("click", () => {
    if (isTurning || position === 1) return;
    position = 1;
    renderBook();
    rightPage.querySelector(".theme-button").focus({ preventScroll: true });
  });
  book.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || isTurning || portrait.matches || imageDialog.open) return;
    suppressBookClickUntil = 0;
    bookGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  window.addEventListener("pointerup", (event) => {
    if (!bookGesture || event.pointerId !== bookGesture.id) return;
    const gesture = bookGesture;
    bookGesture = null;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      suppressBookClickUntil = performance.now() + 300;
      if (Math.abs(dx) >= 45 && !isGrid && !portrait.matches && !imageDialog.open) turn(dx < 0 ? 1 : -1);
    }
  });
  window.addEventListener("pointercancel", (event) => {
    if (bookGesture && event.pointerId === bookGesture.id) bookGesture = null;
  });
  book.addEventListener("click", (event) => {
    if (event.detail !== 0 && performance.now() < suppressBookClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (portrait.matches || imageDialog.open || imageDialog.contains(event.target) || isGrid || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      turn(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  viewToggle.addEventListener("click", () => {
    if (isTurning) return;
    isGrid = !isGrid;
    bookArea.hidden = isGrid;
    gridViewport.hidden = !isGrid;
    viewToggle.setAttribute("aria-pressed", String(isGrid));
    viewToggle.setAttribute("aria-label", `Switch to ${isGrid ? "book" : "grid"} view`);
    viewToggle.title = viewToggle.getAttribute("aria-label");
    document.getElementById("gridIcon").hidden = isGrid;
    document.getElementById("bookIcon").hidden = !isGrid;
    if (isGrid) gridViewport.focus({ preventScroll: true });
    else viewToggle.focus({ preventScroll: true });
  });
  gridViewport.addEventListener("wheel", (event) => {
    const distance = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (distance) {
      event.preventDefault();
      gridViewport.scrollLeft += distance;
    }
  }, { passive: false });
  gridViewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    cancelAnimationFrame(inertiaFrame);
    dragStart = { x: event.clientX, scroll: gridViewport.scrollLeft, lastX: event.clientX, time: performance.now(), distance: 0, velocity: 0 };
    gridViewport.focus({ preventScroll: true });
  });
  window.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const now = performance.now();
    const delta = event.clientX - dragStart.x;
    dragStart.distance = Math.max(dragStart.distance, Math.abs(delta));
    if (dragStart.distance > 4) {
      gridViewport.classList.add("is-dragging");
      gridViewport.scrollLeft = dragStart.scroll - delta;
      const velocity = -(event.clientX - dragStart.lastX) / Math.max(1, now - dragStart.time);
      dragStart.velocity = dragStart.velocity * 0.68 + velocity * 0.32;
    }
    dragStart.lastX = event.clientX;
    dragStart.time = now;
  });
  function endDrag() {
    if (!dragStart) return;
    const drag = dragStart;
    dragStart = null;
    gridViewport.classList.remove("is-dragging");
    if (drag.distance <= 4) return;
    suppressClickUntil = performance.now() + 250;
    if (reducedMotion.matches || Math.abs(drag.velocity) <= 0.025) return;
    const started = performance.now();
    let previousTime = started;
    function coast(now) {
      const elapsed = Math.min(now - previousTime, 32);
      previousTime = now;
      gridViewport.scrollLeft += drag.velocity * elapsed;
      drag.velocity *= Math.exp(-0.004 * elapsed);
      if (Math.abs(drag.velocity) > 0.025 && now - started < 1800) inertiaFrame = requestAnimationFrame(coast);
    }
    inertiaFrame = requestAnimationFrame(coast);
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  modalImage.addEventListener("error", () => {
    modalError.textContent = `Unable to load the full image for ${artworks[activeArtwork].title}.`;
    modalError.hidden = false;
    console.error(`Unable to load full artwork: ${artworks[activeArtwork].full}`);
  });
  document.getElementById("closeDialog").addEventListener("click", () => imageDialog.close());
  document.getElementById("modalPrevious").addEventListener("click", () => changeArtwork(-1));
  document.getElementById("modalNext").addEventListener("click", () => changeArtwork(1));
  imageDialog.addEventListener("click", (event) => {
    if (event.target === imageDialog) imageDialog.close();
  });
  imageDialog.addEventListener("keydown", (event) => {
    if (!imageDialog.open) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      changeArtwork(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  imageDialog.addEventListener("close", () => {
    if (portrait.matches) return;
    if (isGrid && lastOpenedCard && lastOpenedCard.isConnected) lastOpenedCard.focus();
    else {
      const currentCard = rightPage.querySelector(".art-button");
      if (currentCard) currentCard.focus();
    }
  });

  renderBook();
  bookArea.hidden = false;
  viewToggle.disabled = false;
}

loadThemes().then(validateThemes).then(startGallery).catch((error) => {
  console.error("Unable to load the book gallery.", error);
  galleryError.textContent = `The gallery could not load its artwork data. ${error.message}`;
  galleryError.hidden = false;
});
