// Use internal data on file:// and local loopback hosts; otherwise fetch artworks.json.
const DEVELOPER_MODE =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

const galleryError = document.getElementById("galleryError");

document.addEventListener("contextmenu", (event) => event.preventDefault());

function showGalleryError(error) {
  console.error("Unable to load the illustration gallery.", error);
  galleryError.hidden = false;
  galleryError.textContent = window.location.protocol === "file:"
    ? "This local file preview cannot load artworks.json. You do not need Python on GitHub Pages; open the published HTTPS gallery page after the gallery files are published."
    : `The gallery could not load artworks.json. Check that the file is published beside artpage.html. ${error.message}`;
}

function startGallery(artworks) {

  const wallViewport = document.getElementById("wallViewport");
  const wallTrack = document.getElementById("wallTrack");
  const atmosphere = document.getElementById("atmosphere");
  const depthTrack = document.createElement("div");
  depthTrack.className = "depth-track";
  depthTrack.setAttribute("aria-hidden", "true");
  atmosphere.append(depthTrack);
  const wallSets = [];
  const interfaceLayer = document.querySelector(".interface");
  const imageDialog = document.getElementById("imageDialog");
  const modalImage = document.getElementById("modalImage");
  const modalCard = document.getElementById("modalCard");
  const modalFlipper = document.getElementById("modalFlipper");
  const modalTitle = document.getElementById("modalTitle");
  const modalDescription = document.getElementById("modalDescription");
  let cycleWidth = 0;
  let depthScroll = 0;
  let lastWallScroll = 0;
  let activeArtworkIndex = 0;
  let lastOpenedCard = null;
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let dragVelocity = 0;
  let inertiaFrame = 0;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragDistance = 0;
  let suppressClickUntil = 0;
  let hintTimer = 0;
  const desktopArtworkScales = artworks.map(() => (0.7 + Math.random() * 0.3).toFixed(3));
  const mobileArtworkScales = artworks.map(() => (0.8 + Math.random() * 0.2).toFixed(3));
  const depthTops = [18, 82, 25, 76, 43, 62];
  const depthOffsets = [-42, 48, -54, 38, 56, -34];
  const depthScales = [0.82, 1, 0.76, 0.92, 0.86, 1.04];

  function createArtworkCard(artwork, index, setIndex) {
    const positions = [
      { top: "34%" },
      { top: "68%" },
      { top: "36%" },
      { top: "66%" }
    ];
    const card = document.createElement("button");
    card.className = "art-card";
    card.type = "button";
    card.style.setProperty("--left", `calc(${index + 0.5} * var(--slot-size))`);
    card.style.setProperty("--mobile-left", `${(index + 0.5) * 100}vw`);
    card.style.setProperty("--top", positions[index % positions.length].top);
    card.style.setProperty("--scale", desktopArtworkScales[index]);
    card.style.setProperty("--mobile-scale", mobileArtworkScales[index]);
    card.style.setProperty("--float-duration", `${5 + index * 0.7}s`);
    card.style.setProperty("--float-delay", `${-index * 0.8}s`);
    card.dataset.artworkIndex = String(index);
    card.setAttribute("aria-label", `View ${artwork.title}`);
    card.tabIndex = setIndex === 1 ? 0 : -1;

    const image = document.createElement("img");
    image.src = artwork.thumb;
    image.alt = "";
    image.loading = "eager";
    image.decoding = "async";
    image.draggable = false;
    card.append(image);
    card.addEventListener("click", (event) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }
      openArtwork(index, card);
    });
    return card;
  }

  function createWall() {
    for (let setIndex = 0; setIndex < 3; setIndex += 1) {
      const set = document.createElement("div");
      set.className = "wall-set";
      set.style.setProperty("--artwork-count", String(artworks.length));
      if (setIndex !== 1) {
        set.setAttribute("aria-hidden", "true");
      }
      artworks.forEach((artwork, index) => {
        set.append(createArtworkCard(artwork, index, setIndex));
      });
      wallSets.push(set);
      wallTrack.append(set);

      const depthSet = document.createElement("div");
      depthSet.className = "depth-set";
      depthSet.style.setProperty("--artwork-count", String(artworks.length));
      artworks.forEach((artwork, index) => {
        const depthImage = document.createElement("img");
        depthImage.className = "depth-art";
        depthImage.src = artwork.thumb;
        depthImage.alt = "";
        depthImage.loading = "eager";
        depthImage.decoding = "async";
        depthImage.draggable = false;
        depthImage.style.setProperty("--depth-top", `${depthTops[index % depthTops.length]}%`);
        depthImage.style.setProperty("--depth-left", `calc(${index + 0.5} * var(--slot-size) + ${depthOffsets[index % depthOffsets.length]}px)`);
        depthImage.style.setProperty("--depth-scale", String(depthScales[index % depthScales.length]));
        depthSet.append(depthImage);
      });
      depthTrack.append(depthSet);
    }
  }

  function measureWall() {
    cycleWidth = wallSets[1].offsetLeft - wallSets[0].offsetLeft;
    wallViewport.scrollLeft = wallSets[1].offsetLeft;
    lastWallScroll = wallViewport.scrollLeft;
    depthScroll = 0;
    depthTrack.style.transform = "translate3d(0, 0, 0)";
  }

  function syncDepthWall() {
    const scrollLeft = wallViewport.scrollLeft;
    const delta = scrollLeft - lastWallScroll;
    lastWallScroll = scrollLeft;
    if (cycleWidth && Math.abs(delta) <= cycleWidth * 0.5) {
      depthScroll = (depthScroll + delta * 0.72 + cycleWidth) % cycleWidth;
      depthTrack.style.transform = `translate3d(${-depthScroll}px, 0, 0)`;
    }
  }

  function keepWallLooping() {
    if (!cycleWidth) {
      return;
    }
    if (wallViewport.scrollLeft < cycleWidth * 0.5) {
      wallViewport.scrollLeft += cycleWidth;
    } else if (wallViewport.scrollLeft > cycleWidth * 1.5) {
      wallViewport.scrollLeft -= cycleWidth;
    }
  }

  function showHintWhenIdle() {
    interfaceLayer.classList.add("is-browsing");
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      interfaceLayer.classList.remove("is-browsing");
    }, 1200);
  }

  function openArtwork(index, card) {
    activeArtworkIndex = index;
    lastOpenedCard = wallSets[1].querySelector(`[data-artwork-index="${index}"]`);
    if (!lastOpenedCard || card.closest(".wall-set") === wallSets[1]) {
      lastOpenedCard = card;
    }
    showActiveArtwork().then(() => imageDialog.showModal());
  }

  function setFlipped(flipped, animate = true) {
    modalFlipper.classList.toggle("no-transition", !animate);
    modalCard.classList.toggle("is-flipped", flipped);
    modalCard.setAttribute("aria-pressed", String(flipped));
  }

  // Resolves once the image is decoded so the dialog never shows a half-sized image.
  function showActiveArtwork() {
    const artwork = artworks[activeArtworkIndex];
    setFlipped(false, false);
    modalTitle.textContent = artwork.title;
    modalDescription.textContent = artwork.description;
    modalImage.alt = artwork.alt;
    modalImage.src = artwork.full;
    return modalImage.decode().catch(() => {});
  }

  function changeArtwork(direction) {
    activeArtworkIndex = (activeArtworkIndex + direction + artworks.length) % artworks.length;
    showActiveArtwork();
  }

  function moveAlongWall(direction) {
    const card = wallSets[1].querySelector(".art-card");
    const distance = card.getBoundingClientRect().width * 1.5;
    wallViewport.scrollBy({
      left: direction * distance,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
    showHintWhenIdle();
  }

  createWall();
  wallViewport.addEventListener("scroll", () => {
    keepWallLooping();
    syncDepthWall();
    showHintWhenIdle();
  }, { passive: true });

  wallViewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) {
      return;
    }
    cancelAnimationFrame(inertiaFrame);
    isDragging = true;
    dragStartX = event.clientX;
    dragStartScroll = wallViewport.scrollLeft;
    lastPointerX = event.clientX;
    lastPointerTime = performance.now();
    dragVelocity = 0;
    dragDistance = 0;
    wallViewport.focus({ preventScroll: true });
    showHintWhenIdle();
  });

  window.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }
    const now = performance.now();
    const elapsed = Math.max(1, now - lastPointerTime);
    const delta = event.clientX - dragStartX;
    dragDistance = Math.max(dragDistance, Math.abs(delta));
    if (dragDistance > 4) {
      wallViewport.classList.add("is-dragging");
      wallViewport.scrollLeft = dragStartScroll - delta;
      const instantVelocity = -(event.clientX - lastPointerX) / elapsed;
      dragVelocity = dragVelocity * 0.68 + instantVelocity * 0.32;
    }
    lastPointerX = event.clientX;
    lastPointerTime = now;
  });

  function coast() {
    const started = performance.now();
    let previousTime = started;
    function step(now) {
      const elapsed = Math.min(now - previousTime, 32);
      previousTime = now;
      wallViewport.scrollLeft += dragVelocity * elapsed;
      dragVelocity *= Math.exp(-0.004 * elapsed);
      if (Math.abs(dragVelocity) > 0.025 && now - started < 1800) {
        inertiaFrame = requestAnimationFrame(step);
      } else {
        inertiaFrame = 0;
      }
    }
    inertiaFrame = requestAnimationFrame(step);
  }

  function endDrag() {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    if (dragDistance > 4) {
      suppressClickUntil = performance.now() + 250;
    }
    wallViewport.classList.remove("is-dragging");
    if (dragDistance > 4 && Math.abs(dragVelocity) > 0.025) {
      coast();
    }
  }

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  wallViewport.addEventListener("wheel", (event) => {
    const distance = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (distance) {
      event.preventDefault();
      wallViewport.scrollLeft += distance;
      showHintWhenIdle();
    }
  }, { passive: false });

  wallViewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveAlongWall(event.key === "ArrowRight" ? 1 : -1);
    }
  });

  document.getElementById("previousButton").addEventListener("click", () => moveAlongWall(-1));
  document.getElementById("nextButton").addEventListener("click", () => moveAlongWall(1));
  document.getElementById("closeDialog").addEventListener("click", () => imageDialog.close());
  document.getElementById("modalPrevious").addEventListener("click", () => changeArtwork(-1));
  document.getElementById("modalNext").addEventListener("click", () => changeArtwork(1));
  modalCard.addEventListener("click", () => setFlipped(!modalCard.classList.contains("is-flipped")));
  modalCard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFlipped(!modalCard.classList.contains("is-flipped"));
    }
  });
  imageDialog.addEventListener("click", (event) => {
    if (event.target === imageDialog) {
      imageDialog.close();
    }
  });
  imageDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      changeArtwork(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  imageDialog.addEventListener("close", () => {
    if (lastOpenedCard && lastOpenedCard.isConnected) {
      lastOpenedCard.focus();
    }
  });

  window.addEventListener("resize", measureWall);
  measureWall();
}

function validateArtworks(artworks) {
  if (!Array.isArray(artworks) || artworks.length === 0) {
    throw new TypeError("Artwork manifest must be a non-empty array.");
  }
  artworks.forEach((artwork, index) => {
    if (!artwork || ["title", "alt", "description", "thumb", "full"].some((key) => typeof artwork[key] !== "string" || !artwork[key].trim())) {
      throw new TypeError(`Artwork at index ${index} must include title, alt, description, thumb, and full strings.`);
    }
  });
  return artworks;
}

function loadArtworks() {
  if (DEVELOPER_MODE) {
    return Promise.resolve(window.INTERNAL_ARTWORKS);
  }
  return fetch(new URL("artworks.json", window.location.href)).then((response) => {
    if (!response.ok) {
      throw new Error(`Artwork manifest request failed with status ${response.status}.`);
    }
    return response.json();
  });
}

loadArtworks()
  .then(validateArtworks)
  .then(startGallery)
  .catch(showGalleryError);
