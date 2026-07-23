(() => {
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const list = document.getElementById("projects-list");
  const scrollRoot = document.getElementById("content-scroll");
  const navigation = document.querySelector(".projects-navigation");
  const rowsBySlug = new Map();
  const openedRows = new Set();
  const mobileQuery = window.matchMedia("(max-width: 768px)");
  const priorityEnabled = document.body.dataset.projectPriority !== "off";
  const openAllProjects = document.body.dataset.projectsOpen === "all";
  const SCROLL_HINT_RATIO = 0.5;
  const SCROLL_HINT_SCROLL_FACTOR = 1;
  let focusedRow = null;
  let scrollHintFrame = null;

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

  function getImageSource(src) {
    if (mobileQuery.matches && src.endsWith(".webp")) {
      return src.replace(/\.webp$/, "-mobile.webp");
    }
    return src;
  }

  function getVideoSource(src) {
    if (!mobileQuery.matches) return src;
    if (src.endsWith("-optimized.mp4")) {
      return src.replace(/-optimized\.mp4$/, "-mobile.mp4");
    }
    return src.endsWith(".mp4") ? src.replace(/\.mp4$/, "-mobile.mp4") : src;
  }

  function activateProjectMedia(row) {
    row.querySelectorAll("img[data-src]").forEach((image) => {
      if (priorityEnabled) image.fetchPriority = "high";
      image.src = image.dataset.src;
      delete image.dataset.src;
    });

    row.querySelectorAll("video").forEach((video) => {
      if (video.dataset.poster) {
        video.poster = video.dataset.poster;
        delete video.dataset.poster;
      }
      if (video.dataset.src) {
        video.preload = "auto";
        video.src = video.dataset.src;
        delete video.dataset.src;
      }
      video.play().catch(() => {});
    });
  }

  function preloadProjectLead(row) {
    if (!priorityEnabled || openedRows.has(row) || row.dataset.leadReady === "true") {
      return;
    }
    row.dataset.leadReady = "true";
    const leadMedia = Array.from(
      row.querySelectorAll("img[data-src], video[data-src]"),
    ).slice(0, 2);
    leadMedia.forEach((media) => {
      if (media instanceof HTMLImageElement) {
        media.fetchPriority = "high";
      } else {
        media.preload = "auto";
      }
      media.src = media.dataset.src;
      delete media.dataset.src;
    });
  }

  function setupLeadPreloading() {
    if (!priorityEnabled) return;
    const start = () => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            preloadProjectLead(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { root: scrollRoot, rootMargin: "200px 0px", threshold: 0.01 },
      );
      rowsBySlug.forEach((row) => {
        observer.observe(row);
        row.addEventListener("pointerenter", () => preloadProjectLead(row), {
          once: true,
          passive: true,
        });
        row.addEventListener("focusin", () => preloadProjectLead(row), {
          once: true,
        });
        row.addEventListener("pointerdown", () => preloadProjectLead(row), {
          once: true,
          passive: true,
        });
      });
    };
    if (window.__portfolioPriorityReady) start();
    else window.addEventListener("portfolio:priority-ready", start, { once: true });
  }

  function signalCoversReady() {
    const covers = Array.from(document.querySelectorAll(".project-cover img"));
    const pending = covers.map((image) => {
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
        if (image.complete) resolve();
      });
    });

    Promise.all(pending).then(() => {
      window.__portfolioPriorityReady = true;
      window.dispatchEvent(new Event("portfolio:priority-ready"));
    });
  }

  function alignProjectBelowNavigation(row) {
    if (!scrollRoot || !navigation) return;
    window.requestAnimationFrame(() => {
      // Use the first project's rendered resting position as the reference.
      // This captures the actual navbar spacing, including CSS margins and
      // responsive layout values, instead of recreating it in JavaScript.
      const firstRow = list.querySelector(".project-row");
      const targetTop = firstRow
        ? firstRow.getBoundingClientRect().top + scrollRoot.scrollTop
        : 0;
      scrollRoot.scrollTop += row.getBoundingClientRect().top - targetTop;
    });
  }

  function setRowActive(row, isActive) {
    row.querySelector(".project-details").hidden = !isActive;
    row
      .querySelectorAll(".project-cover, .project-media-image")
      .forEach((button) => button.setAttribute("aria-pressed", String(isActive)));
  }

  function setRowOpen(row, isOpen) {
    row
      .querySelector(".project-cover")
      ?.setAttribute("aria-expanded", String(isOpen));
  }

  function focusProject(row) {
    if (focusedRow && focusedRow !== row) {
      setRowActive(focusedRow, false);
    }
    setRowActive(row, true);
    focusedRow = row;
    alignProjectBelowNavigation(row);
  }

  function blurProject(row, shouldWriteHash = true) {
    if (!row) return;
    setRowActive(row, false);
    if (focusedRow === row) focusedRow = null;
    if (shouldWriteHash) removeHash();
  }

  function closeProject(row, shouldWriteHash = true) {
    if (!row) return;
    const track = row.querySelector(".project-track");
    const cover = row.querySelector(".project-cover");
    track.scrollLeft = 0;
    track.hidden = true;
    row.classList.remove("project-gallery-open");
    row.classList.remove("project-open");
    if (cover && cover.parentElement === track) row.insertBefore(cover, track);
    row.querySelectorAll("video").forEach((video) => video.pause());
    setRowActive(row, false);
    setRowOpen(row, false);
    if (focusedRow === row) focusedRow = null;
    openedRows.delete(row);
    list.classList.toggle("has-open-project", openedRows.size > 0);
    if (shouldWriteHash) removeHash();
  }

  function openProject(slug, shouldWriteHash = true, shouldFocus = true) {
    const row = rowsBySlug.get(slug);
    if (!row) return;
    if (openedRows.has(row)) {
      if (shouldFocus) focusProject(row);
      if (shouldWriteHash) setHash(slug);
      return;
    }

    const track = row.querySelector(".project-track");
    const cover = row.querySelector(".project-cover");
    const isSingleImage = row.dataset.singleImage === "true";
    openedRows.add(row);
    row.classList.add("project-open");
    list.classList.add("has-open-project");
    setRowOpen(row, true);
    if (shouldFocus) focusProject(row);
    if (!isSingleImage) {
      if (cover?.dataset.mediaType !== "video") track.prepend(cover);
      row.classList.add("project-gallery-open");
      track.hidden = false;
      track.scrollLeft = 0;
      activateProjectMedia(row);
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
    toggleProjectActive(row, project.slug);
  }

  function toggleProjectActive(row, slug) {
    if (!row) return;
    if (focusedRow === row) blurProject(row, true);
    else {
      focusProject(row);
      setHash(slug);
    }
  }

  function createCover(project, projectIndex) {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const firstMedia = project.media[0];
    const src = firstMedia.type === "video" ? firstMedia.poster : firstMedia.src;
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
      if (performance.now() < Number(row?.dataset.suppressClickUntil || 0)) {
        event.preventDefault();
        return;
      }
      if (!openedRows.has(row)) openProject(project.slug, true);
      else toggleProjectActive(row, project.slug);
    });

    image.alt = "";
    image.draggable = false;
    image.decoding = "async";
    image.width = 1500;
    image.height = 1000;
    image.fetchPriority = projectIndex < 2 ? "high" : "auto";
    if (placeholder) {
      button.style.setProperty("--project-placeholder", `url("${placeholder}")`);
    }
    image.addEventListener(
      "load",
      () => button.classList.add("media-loaded"),
      { once: true },
    );
    image.src = getImageSource(src);
    button.appendChild(image);
    return button;
  }

  function createImage(project, media) {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const placeholder = window.PROJECT_PLACEHOLDERS?.[media.src];

    button.type = "button";
    button.className = "project-media project-media-image";
    button.setAttribute("aria-label", `Close ${project.title}`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => handleMediaClick(event, project));

    image.alt = "";
    image.draggable = false;
    image.decoding = "async";
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
    image.dataset.src = getImageSource(media.src);
    button.appendChild(image);
    return button;
  }

  function createVideo(project, media, mediaIndex) {
    const wrapper = document.createElement("div");
    const video = document.createElement("video");
    const placeholder =
      window.PROJECT_PLACEHOLDERS?.[media.src] ||
      window.PROJECT_PLACEHOLDERS?.[media.poster];

    wrapper.className = "project-media project-media-video";
    if (mediaIndex === 0) wrapper.classList.add("project-media-cover-video");
    if (media.unmute) wrapper.classList.add("video-unmute");
    wrapper.addEventListener("click", (event) => handleMediaClick(event, project));
    if (placeholder) {
      wrapper.style.setProperty("--project-placeholder", `url("${placeholder}")`);
    }
    video.muted = true;
    video.draggable = false;
    video.loop = true;
    video.playsInline = true;
    video.addEventListener(
      "loadeddata",
      () => wrapper.classList.add("media-loaded"),
      { once: true },
    );
    if (media.poster) {
      const poster = getImageSource(media.poster);
      if (mediaIndex === 0) video.poster = poster;
      else video.dataset.poster = poster;
    }
    if (mediaIndex === 0) {
      video.preload = "auto";
      video.src = getVideoSource(media.src);
    } else {
      video.dataset.src = getVideoSource(media.src);
    }
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
    let mouseDrag = null;

    track.addEventListener("dragstart", (event) => event.preventDefault());

    track.addEventListener(
      "click",
      (event) => {
        if (event.target.closest(".video-unmute-btn")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        const suppressUntil = Number(row.dataset.suppressClickUntil || 0);
        if (performance.now() < suppressUntil) return;
        toggleProjectActive(row, row.dataset.projectSlug);
      },
      true,
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

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (event.target.closest(".video-unmute-btn")) return;
      mouseDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: track.scrollLeft,
        moved: false,
        captured: false,
      };
    });

    track.addEventListener("pointermove", (event) => {
      if (!mouseDrag || event.pointerId !== mouseDrag.pointerId) return;
      const distance = event.clientX - mouseDrag.startX;
      const verticalDistance = event.clientY - mouseDrag.startY;
      if (
        Math.abs(distance) > 8 &&
        Math.abs(distance) > Math.abs(verticalDistance)
      ) {
        mouseDrag.moved = true;
        if (!mouseDrag.captured) {
          track.setPointerCapture(event.pointerId);
          track.classList.add("is-dragging");
          mouseDrag.captured = true;
        }
      }
      if (!mouseDrag.moved) return;
      track.scrollLeft = mouseDrag.startScrollLeft - distance;
      event.preventDefault();
    });

    const endMouseDrag = (event) => {
      if (!mouseDrag || event.pointerId !== mouseDrag.pointerId) return;
      if (mouseDrag.captured && track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
      track.classList.remove("is-dragging");
      if (mouseDrag.moved) {
        row.dataset.suppressClickUntil = String(performance.now() + 250);
      }
      mouseDrag = null;
    };
    track.addEventListener("pointerup", endMouseDrag);
    track.addEventListener("pointercancel", endMouseDrag);
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
    // CSS reference pixels: 4 cm at the standard 96 dpi reference density.
    const edgeSize = Math.round((4 / 2.54) * 96);
    let edgeTrack = null;
    let edgeDirection = 0;
    let edgeSpeed = 0;
    let edgeFrame = null;

    function trackAtVerticalPosition(y) {
      return Array.from(document.querySelectorAll(".project-track")).find(
        (track) => {
          if (track.hidden) return false;
          const rect = track.getBoundingClientRect();
          return y >= rect.top && y <= rect.bottom;
        },
      );
    }

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
      const track = trackAtVerticalPosition(event.clientY);
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

  function setupVerticalScrollHints() {
    if (
      !scrollRoot ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const tracks = Array.from(document.querySelectorAll(".project-track"));
    let nextTrackIndex = 0;
    let activeHint = null;
    let lastScrollTop = scrollRoot.scrollTop;
    let hintsDisabled = false;

    function updateScrollHints() {
      scrollHintFrame = null;
      let scrollDelta = scrollRoot.scrollTop - lastScrollTop;
      lastScrollTop = scrollRoot.scrollTop;
      if (scrollDelta < 0) hintsDisabled = true;
      if (hintsDisabled || scrollDelta <= 0) return;

      while (scrollDelta > 0 && nextTrackIndex < tracks.length) {
        if (!activeHint) {
          const track = tracks[nextTrackIndex];
          const cover = track.querySelector(
            ".project-cover, .project-media-cover-video",
          );
          const maxScroll = track.scrollWidth - track.clientWidth;
          const hintDistance = Math.min(
            (cover?.getBoundingClientRect().width || 0) * SCROLL_HINT_RATIO,
            maxScroll,
          );
          nextTrackIndex += 1;
          if (track.hidden || hintDistance <= 1) continue;
          activeHint = {
            track,
            target: Math.min(track.scrollLeft + hintDistance, maxScroll),
          };
        }

        const remaining = activeHint.target - activeHint.track.scrollLeft;
        const movement = Math.min(
          scrollDelta * SCROLL_HINT_SCROLL_FACTOR,
          remaining,
        );
        activeHint.track.scrollLeft += movement;
        scrollDelta -= movement / SCROLL_HINT_SCROLL_FACTOR;
        if (activeHint.track.scrollLeft >= activeHint.target - 1) {
          activeHint = null;
        }
      }
    }

    scrollRoot.addEventListener(
      "scroll",
      () => {
        if (scrollHintFrame === null) {
          scrollHintFrame = window.requestAnimationFrame(updateScrollHints);
        }
      },
      { passive: true },
    );
  }

  renderProjects();
  if (openAllProjects) {
    rowsBySlug.forEach((row, slug) => openProject(slug, false, false));
  }
  if (location.hash) removeHash();
  setupEdgeScrolling();
  setupVerticalScrollHints();
  setupLeadPreloading();
  signalCoversReady();

  window.closeProjectDetails = () => {
    if (openAllProjects) return;
    openedRows.forEach((row) => closeProject(row, false));
    removeHash();
  };
  window.addEventListener("hashchange", () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (rowsBySlug.has(slug)) openProject(slug, false);
    else removeHash();
  });
})();
