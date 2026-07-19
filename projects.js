(() => {
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const list = document.getElementById("projects-list");
  const scrollRoot = document.getElementById("content-scroll");
  const navigation = document.querySelector(".projects-navigation");
  const rowsBySlug = new Map();
  const openedRows = new Set();
  const mobileQuery = window.matchMedia("(max-width: 768px)");
  const DRIFT_SPEED = 18;
  let focusedRow = null;
  let drift = null;

  if (!list) return;

  function removeHash() {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  function setHash(slug) {
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#${encodeURIComponent(slug)}`,
    );
  }

  function getMobileAsset(src) {
    return src?.endsWith(".webp")
      ? src.replace(/\.webp$/, "-mobile.webp")
      : null;
  }

  function getResponsiveVideoAsset(src) {
    if (!mobileQuery.matches) return src;
    if (src.endsWith("-optimized.mp4")) {
      return src.replace(/-optimized\.mp4$/, "-mobile.mp4");
    }
    return src.endsWith(".mp4") ? src.replace(/\.mp4$/, "-mobile.mp4") : src;
  }

  function stopProjectDrift(row) {
    if (!drift || (row && drift.row !== row)) return;
    window.cancelAnimationFrame(drift.frame);
    drift = null;
  }

  function startProjectDrift(row) {
    const track = row.querySelector(".project-track");
    stopProjectDrift();
    if (!mobileQuery.matches || !track || track.hidden) return;

    const state = {
      row,
      track,
      frame: 0,
      lastTime: null,
      position: track.scrollLeft,
    };

    const move = (time) => {
      if (drift !== state) return;
      if (state.lastTime !== null) {
        const elapsed = Math.min(time - state.lastTime, 50) / 1000;
        const maxScroll = state.track.scrollWidth - state.track.clientWidth;
        if (maxScroll > 1) {
          state.position += DRIFT_SPEED * elapsed;
          if (state.position >= maxScroll) state.position = 0;
          state.track.scrollLeft = state.position;
        }
      }
      state.lastTime = time;
      state.frame = window.requestAnimationFrame(move);
    };

    drift = state;
    state.frame = window.requestAnimationFrame(move);
  }

  function loadImage(image, priority = "high") {
    image.fetchPriority = priority;
    if (!image.dataset.src) return;
    const picture = image.closest("picture");
    picture?.querySelectorAll("source[data-srcset]").forEach((source) => {
      source.srcset = source.dataset.srcset;
      delete source.dataset.srcset;
    });
    image.src = image.dataset.src;
    delete image.dataset.src;
  }

  function loadVideo(video, shouldPlay = true) {
    video.autoplay = shouldPlay;
    const source = video.querySelector("source[data-src]");
    if (!source) {
      if (shouldPlay) video.play().catch(() => {});
      return;
    }
    if (video.dataset.poster) {
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
    source.src = getResponsiveVideoAsset(source.dataset.src);
    delete source.dataset.src;
    video.preload = "auto";
    video.load();
    if (shouldPlay) video.play().catch(() => {});
  }

  function loadProjectMedia(row) {
    row.querySelectorAll("img").forEach((image) => loadImage(image, "high"));
    row.querySelectorAll("video").forEach((video) => loadVideo(video, true));
  }

  function preloadCoverVideos() {
    document
      .querySelectorAll(".project-media-cover-video video")
      .forEach((video) => loadVideo(video, false));
  }

  function preloadAllProjectMedia() {
    if (navigator.connection?.saveData) return;
    const covers = Array.from(document.querySelectorAll(".project-cover img"));
    const coverReady = covers.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    });

    Promise.all(coverReady).then(() => {
      document.querySelectorAll(".project-media").forEach((media) => {
        const image = media.querySelector("img");
        const video = media.querySelector("video");
        if (image) loadImage(image, "low");
        if (video) loadVideo(video, false);
      });
    });
  }

  function alignProjectBelowNavigation(row) {
    if (!scrollRoot || !navigation) return;
    window.requestAnimationFrame(() => {
      const gap =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--project-gap",
          ),
        ) || 0;
      const targetTop = navigation.getBoundingClientRect().bottom + gap;
      scrollRoot.scrollTop += row.getBoundingClientRect().top - targetTop;
    });
  }

  function setRowActive(row, isActive) {
    row.querySelector(".project-details").hidden = !isActive;
    row
      .querySelectorAll(".project-cover, .project-media-image")
      .forEach((button) => button.setAttribute("aria-pressed", String(isActive)));
    row
      .querySelector(".project-cover")
      ?.setAttribute("aria-expanded", String(isActive));
  }

  function focusProject(row) {
    if (focusedRow && focusedRow !== row) {
      focusedRow.querySelector(".project-details").hidden = true;
    }
    row.querySelector(".project-details").hidden = false;
    focusedRow = row;
    alignProjectBelowNavigation(row);
  }

  function blurProject(row, shouldWriteHash = true) {
    if (!row) return;
    row.querySelector(".project-details").hidden = true;
    if (focusedRow === row) focusedRow = null;
    if (shouldWriteHash) removeHash();
  }

  function closeProject(row, shouldWriteHash = true) {
    if (!row) return;
    const track = row.querySelector(".project-track");
    const cover = row.querySelector(".project-cover");
    stopProjectDrift(row);
    track.scrollLeft = 0;
    track.hidden = true;
    row.classList.remove("project-gallery-open");
    if (cover && cover.parentElement === track) row.insertBefore(cover, track);
    row.querySelectorAll("video").forEach((video) => video.pause());
    setRowActive(row, false);
    if (focusedRow === row) focusedRow = null;
    openedRows.delete(row);
    if (shouldWriteHash) removeHash();
  }

  function openProject(slug, shouldWriteHash = true) {
    const row = rowsBySlug.get(slug);
    if (!row) return;
    if (openedRows.has(row)) {
      focusProject(row);
      if (shouldWriteHash) setHash(slug);
      return;
    }

    const track = row.querySelector(".project-track");
    const cover = row.querySelector(".project-cover");
    const isSingleImage = row.dataset.singleImage === "true";
    openedRows.add(row);
    setRowActive(row, true);
    focusProject(row);
    if (!isSingleImage) {
      if (cover?.dataset.mediaType !== "video") track.prepend(cover);
      row.classList.add("project-gallery-open");
      track.hidden = false;
      track.scrollLeft = 0;
      loadProjectMedia(row);
      window.requestAnimationFrame(() => startProjectDrift(row));
    }
    if (shouldWriteHash) setHash(slug);
  }

  function handleMediaClick(event, project) {
    event.stopPropagation();
    const row = rowsBySlug.get(project.slug);
    const suppressUntil = Number(row?.dataset.suppressClickUntil || 0);
    if (performance.now() < suppressUntil) {
      event.preventDefault();
      return;
    }
    if (!row) return;
    if (focusedRow === row) blurProject(row, true);
    else {
      focusProject(row);
      setHash(project.slug);
    }
  }

  function createCover(project, projectIndex) {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const picture = document.createElement("picture");
    const firstMedia = project.media[0];
    const src = firstMedia.type === "video" ? firstMedia.poster : firstMedia.src;
    const mobileSrc = getMobileAsset(src);
    const placeholder = window.PROJECT_PLACEHOLDERS?.[src];

    button.type = "button";
    button.className = "project-cover";
    button.dataset.mediaType = firstMedia.type;
    button.setAttribute("aria-label", `Open ${project.title}`);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const row = rowsBySlug.get(project.slug);
      if (!openedRows.has(row)) openProject(project.slug, true);
      else if (focusedRow === row) blurProject(row, true);
      else {
        focusProject(row);
        setHash(project.slug);
      }
    });

    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";
    image.width = 1500;
    image.height = 1000;
    image.fetchPriority = projectIndex === 0 ? "high" : "auto";
    if (placeholder) {
      button.style.setProperty("--project-placeholder", `url("${placeholder}")`);
    }
    image.addEventListener(
      "load",
      () => button.classList.add("media-loaded"),
      { once: true },
    );

    if (mobileSrc) {
      const mobileSource = document.createElement("source");
      mobileSource.media = "(max-width: 768px)";
      mobileSource.type = "image/webp";
      mobileSource.srcset = mobileSrc;
      picture.appendChild(mobileSource);
    }
    image.src = src;
    picture.appendChild(image);
    button.appendChild(picture);
    return button;
  }

  function createImage(project, media) {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const picture = document.createElement("picture");
    const mobileSrc = getMobileAsset(media.src);
    const placeholder = window.PROJECT_PLACEHOLDERS?.[media.src];

    button.type = "button";
    button.className = "project-media project-media-image";
    button.setAttribute("aria-label", `Close ${project.title}`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => handleMediaClick(event, project));

    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "auto";
    image.width = media.width;
    image.height = media.height;
    if (placeholder) {
      button.style.setProperty("--project-placeholder", `url("${placeholder}")`);
    }
    image.addEventListener(
      "load",
      () => button.classList.add("media-loaded"),
      { once: true },
    );

    if (mobileSrc) {
      const mobileSource = document.createElement("source");
      mobileSource.media = "(max-width: 768px)";
      mobileSource.type = "image/webp";
      mobileSource.dataset.srcset = mobileSrc;
      picture.appendChild(mobileSource);
    }
    image.dataset.src = media.src;
    picture.appendChild(image);
    button.appendChild(picture);
    return button;
  }

  function createVideo(project, media, mediaIndex) {
    const wrapper = document.createElement("div");
    const video = document.createElement("video");
    const source = document.createElement("source");

    wrapper.className = "project-media project-media-video";
    if (mediaIndex === 0) wrapper.classList.add("project-media-cover-video");
    if (media.unmute) wrapper.classList.add("video-unmute");
    wrapper.addEventListener("click", (event) => handleMediaClick(event, project));
    video.autoplay = false;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    if (media.poster) {
      const mobilePoster = getMobileAsset(media.poster);
      const poster = mobileQuery.matches && mobilePoster
        ? mobilePoster
        : media.poster;
      if (mediaIndex === 0) video.poster = poster;
      else video.dataset.poster = poster;
    }
    source.dataset.src = media.src;
    video.appendChild(source);
    wrapper.appendChild(video);

    if (media.unmute) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "video-unmute-btn";
      button.textContent = "Unmute";
      button.setAttribute("aria-pressed", "false");
      wrapper.appendChild(button);
    }
    return wrapper;
  }

  function createDetails(project) {
    const details = document.createElement("div");
    const title = document.createElement("p");
    details.className = "project-details";
    details.hidden = true;
    title.className = "project-title";
    title.textContent = project.title;
    details.appendChild(title);

    if (project.date) {
      const date = document.createElement("p");
      date.className = "project-date";
      date.textContent = project.date;
      details.appendChild(date);
    }
    if (project.description) {
      const description = document.createElement("p");
      description.className = "project-description";
      description.textContent = project.description;
      details.appendChild(description);
    }
    project.info.forEach((line) => {
      const info = document.createElement("p");
      info.className = "project-info";
      info.innerHTML = line;
      details.appendChild(info);
    });
    return details;
  }

  function setupTrackInteraction(row, track) {
    let touchStart = null;
    track.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) stopProjectDrift(row);
      },
      { passive: true },
    );
    track.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
      },
      { passive: true },
    );
    track.addEventListener(
      "touchmove",
      (event) => {
        if (!touchStart) return;
        const touch = event.touches[0];
        if (!touch) return;
        const distanceX = Math.abs(touch.clientX - touchStart.x);
        const distanceY = Math.abs(touch.clientY - touchStart.y);
        if (distanceX > 8 && distanceX > distanceY) {
          stopProjectDrift(row);
          row.dataset.suppressClickUntil = String(performance.now() + 500);
          touchStart = null;
        }
      },
      { passive: true },
    );
    const clearTouch = () => {
      touchStart = null;
    };
    track.addEventListener("touchend", clearTouch, { passive: true });
    track.addEventListener("touchcancel", clearTouch, { passive: true });
  }

  function renderProjects() {
    projects.forEach((project, projectIndex) => {
      const row = document.createElement("section");
      const track = document.createElement("div");
      const cover = createCover(project, projectIndex);
      row.className = `${project.categories.join(" ")} project-row`;
      row.dataset.projectSlug = project.slug;
      row.dataset.singleImage = String(
        project.media.length === 1 && project.media[0]?.type === "image",
      );
      track.className = "project-track";
      track.hidden = true;
      track.setAttribute("aria-label", `${project.title} media`);
      setupTrackInteraction(row, track);

      project.media.forEach((media, mediaIndex) => {
        if (mediaIndex === 0 && media.type === "image") return;
        track.appendChild(
          media.type === "video"
            ? createVideo(project, media, mediaIndex)
            : createImage(project, media),
        );
      });
      row.append(cover, track, createDetails(project));
      list.appendChild(row);
      rowsBySlug.set(project.slug, row);
    });
  }

  function setupEdgeScrolling() {
    const edgeSize = 48;
    let edgeTrack = null;
    let edgeDirection = 0;
    let edgeSpeed = 0;
    let edgeFrame = null;

    function stop() {
      edgeTrack = null;
      edgeDirection = 0;
      edgeSpeed = 0;
      if (edgeFrame !== null) window.cancelAnimationFrame(edgeFrame);
      edgeFrame = null;
    }
    function scroll() {
      if (!edgeTrack || !edgeDirection) {
        edgeFrame = null;
        return;
      }
      const maxScroll = edgeTrack.scrollWidth - edgeTrack.clientWidth;
      if (
        maxScroll <= 0 ||
        (edgeDirection < 0 && edgeTrack.scrollLeft <= 0) ||
        (edgeDirection > 0 && edgeTrack.scrollLeft >= maxScroll)
      ) {
        stop();
        return;
      }
      edgeTrack.scrollLeft += edgeDirection * edgeSpeed;
      edgeFrame = window.requestAnimationFrame(scroll);
    }

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const track = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest?.(".project-track"))
        .find(Boolean);
      const leftDistance = event.clientX;
      const rightDistance = window.innerWidth - event.clientX;
      const atLeft = leftDistance <= edgeSize;
      const atRight = rightDistance <= edgeSize;
      if (!track || (!atLeft && !atRight)) {
        stop();
        return;
      }
      edgeTrack = track;
      edgeDirection = atLeft ? -1 : 1;
      const distance = atLeft ? leftDistance : rightDistance;
      edgeSpeed = Math.max(1, ((edgeSize - distance) / edgeSize) * 10);
      if (edgeFrame === null) edgeFrame = window.requestAnimationFrame(scroll);
    });
    window.addEventListener("blur", stop);
  }

  renderProjects();
  setupEdgeScrolling();
  preloadCoverVideos();
  preloadAllProjectMedia();
  window.__portfolioPriorityReady = true;
  window.dispatchEvent(new Event("portfolio:priority-ready"));

  window.closeProjectDetails = () => {
    openedRows.forEach((row) => closeProject(row, false));
    removeHash();
  };
  mobileQuery.addEventListener("change", () => {
    if (!mobileQuery.matches) {
      stopProjectDrift();
      return;
    }
    const lastOpenedRow = Array.from(openedRows).at(-1);
    if (lastOpenedRow) startProjectDrift(lastOpenedRow);
  });

  const initialSlug = decodeURIComponent(location.hash.slice(1));
  if (rowsBySlug.has(initialSlug)) {
    localStorage.removeItem("selectedFilter");
    openProject(initialSlug, false);
  }
  window.addEventListener("hashchange", () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (rowsBySlug.has(slug)) openProject(slug, false);
    else removeHash();
  });
})();
