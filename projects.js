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
  const VIDEO_DIMENSIONS = {
    "assets/rhytuals/02-motion-optimized.mp4": [720, 1280],
    "assets/rhytuals/02-motion-mobile.mp4": [608, 1080],
    "assets/rhytuals/image/02-motion-optimized.mp4": [960, 1280],
    "assets/rhytuals/image/02-motion-mobile.mp4": [720, 960],
    "assets/rhytuals/image/r-14-optimized.mp4": [1080, 1580],
    "assets/rhytuals/image/r-14-mobile.mp4": [874, 1280],
    "assets/imageofabook/7-optimized.mp4": [1440, 1920],
    "assets/imageofabook/7-mobile.mp4": [960, 1280],
    "assets/digitalforest/03-optimized.mp4": [1700, 1214],
    "assets/digitalforest/03-mobile.mp4": [1080, 772],
    "assets/digitalforest/04-optimized.mp4": [956, 1700],
    "assets/digitalforest/04-mobile.mp4": [608, 1080],
    "assets/digitalforest/videoinstallation-optimized.mp4": [1700, 956],
    "assets/digitalforest/videoinstallation-mobile.mp4": [1080, 608],
    "assets/digitalforest/05-optimized.mp4": [1700, 956],
    "assets/digitalforest/05-mobile.mp4": [1080, 608],
    "assets/digitalforest/06-optimized.mp4": [1700, 956],
    "assets/digitalforest/06-mobile.mp4": [1080, 608],
    "assets/digitalforest/07-optimized.mp4": [1700, 1214],
    "assets/digitalforest/07-mobile.mp4": [1080, 772],
    "assets/digitalforest/09-optimized.mp4": [1700, 1214],
    "assets/digitalforest/09-mobile.mp4": [1080, 772],
    "assets/capsule/desktop-optimized.mp4": [1700, 956],
    "assets/capsule/desktop-mobile.mp4": [1080, 608],
    "assets/capsule/4-optimized.mp4": [1700, 1700],
    "assets/capsule/4-mobile.mp4": [1080, 1080],
    "assets/capsule/3-optimized.mp4": [1700, 1700],
    "assets/capsule/3-mobile.mp4": [1080, 1080],
    "assets/capsule/2-optimized.mp4": [1080, 1080],
    "assets/capsule/2-mobile.mp4": [1080, 1080],
    "assets/capsule/1-optimized.mp4": [1700, 1700],
    "assets/capsule/1-mobile.mp4": [1080, 1080],
    "assets/drawaline/cover.mp4": [1266, 844],
    "assets/drawaline/cover-mobile.mp4": [1080, 720],
    "assets/drawaline/1-optimized.mp4": [1700, 1276],
    "assets/drawaline/1-mobile.mp4": [1080, 810],
    "assets/drawaline/2-optimized.mp4": [1700, 1276],
    "assets/drawaline/2-mobile.mp4": [1080, 810],
    "assets/drawaline/3-optimized.mp4": [1700, 1276],
    "assets/drawaline/3-mobile.mp4": [1080, 810],
    "assets/6am/6am1-optimized.mp4": [1202, 1700],
    "assets/6am/6am1-mobile.mp4": [762, 1080],
    "assets/6am/6am2-optimized.mp4": [720, 1280],
    "assets/6am/6am2-mobile.mp4": [608, 1080],
    "assets/spectathesis/spectathesis-optimized.mp4": [1700, 1134],
    "assets/spectathesis/spectathesis-mobile.mp4": [1080, 720],
    "assets/specta/SPECTA-optimized.mp4": [1700, 956],
    "assets/specta/SPECTA-mobile.mp4": [1080, 608],
    "assets/pixelpushing/Iterationsinversions-optimized.mp4": [1700, 956],
    "assets/pixelpushing/Iterationsinversions-mobile.mp4": [1080, 608],
    "assets/pixelpushing/istallationview-optimized.mp4": [956, 1700],
    "assets/pixelpushing/istallationview-mobile.mp4": [608, 1080],
    "assets/corpomacchina/f-optimized.mp4": [1700, 1134],
    "assets/corpomacchina/f-mobile.mp4": [1080, 720],
  };
  let focusedRow = null;
  let scrollHintFrame = null;
  let mediaGeometryFrame = null;

  if (!list) return;

  function removeHash() {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  function setHash(slug) {
    const hash = slug === "n+" ? slug : encodeURIComponent(slug);
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#${hash}`,
    );
  }

  function getImageSource(src) {
    if (mobileQuery.matches && src.endsWith(".webp")) {
      return src.replace(/\.webp$/, "-mobile.webp");
    }
    return src;
  }

  function getVideoSource(media) {
    const src = media.src;
    if (!mobileQuery.matches) return src;
    if (media.mobileSrc) return media.mobileSrc;
    if (src.endsWith("-optimized.mp4")) {
      return src.replace(/-optimized\.mp4$/, "-mobile.mp4");
    }
    return src.endsWith(".mp4") ? src.replace(/\.mp4$/, "-mobile.mp4") : src;
  }

  function getMediaDimensions(media) {
    if (media.width && media.height) return [media.width, media.height];
    return (
      VIDEO_DIMENSIONS[getVideoSource(media)] ||
      VIDEO_DIMENSIONS[media.src] ||
      null
    );
  }

  function activateProjectImages(row) {
    row.querySelectorAll("img[data-src]").forEach((image) => {
      image.src = image.dataset.src;
      delete image.dataset.src;
    });

    row.querySelectorAll("video").forEach((video) => {
      if (video.dataset.poster) {
        video.poster = video.dataset.poster;
        delete video.dataset.poster;
      }
    });
  }

  function activateProjectVideos(row) {
    row.querySelectorAll("video").forEach((video) => {
      if (video.dataset.src) {
        video.preload = "auto";
        video.src = video.dataset.src;
        delete video.dataset.src;
      }
      if (video.dataset.inViewport === "true") {
        video.play().catch(() => {});
      }
    });
  }

  function activateProjectMedia(row) {
    activateProjectImages(row);
    activateProjectVideos(row);
  }

  function setupVideoLoading() {
    const rowsWithVideos = Array.from(rowsBySlug.values()).filter((row) =>
      row.querySelector("video"),
    );
    const videos = rowsWithVideos.flatMap((row) =>
      Array.from(row.querySelectorAll("video")),
    );

    if (!("IntersectionObserver" in window)) {
      rowsWithVideos.forEach(activateProjectVideos);
      videos.forEach((video) => video.play().catch(() => {}));
      return;
    }

    const playbackObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          video.dataset.inViewport = String(entry.isIntersecting);
          if (entry.isIntersecting) {
            if (!video.dataset.src) video.play().catch(() => {});
          } else if (!video.dataset.longLoaded) {
            video.pause();
          }
        });
      },
      { root: scrollRoot, threshold: 0.01 },
    );
    videos.forEach((video) => playbackObserver.observe(video));

    if (!priorityEnabled) {
      rowsWithVideos.forEach(activateProjectVideos);
      return;
    }

    const loadingObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          activateProjectVideos(entry.target);
          loadingObserver.unobserve(entry.target);
        });
      },
      { root: scrollRoot, rootMargin: "100% 0px", threshold: 0.01 },
    );
    rowsWithVideos.forEach((row) => loadingObserver.observe(row));
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
    const dimensions = getMediaDimensions(firstMedia);

    button.type = "button";
    button.className = "project-cover";
    if (firstMedia.fillRatio) {
      button.classList.add("project-cover-fill");
      button.dataset.fillRatio = String(firstMedia.fillRatio);
    }
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
    // Reserve the real footprint before the file decodes. The previous fixed
    // 3:2 placeholder made centered covers jump horizontally on load.
    image.width = dimensions?.[0] || 1500;
    image.height = dimensions?.[1] || 1000;
    image.fetchPriority = projectIndex < 2 ? "high" : "auto";
    if (placeholder) {
      button.style.setProperty("--project-placeholder", `url("${placeholder}")`);
    }
    image.addEventListener(
      "load",
      () => {
        button.classList.add("media-loaded");
        syncMediaBox(button, image);
      },
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
    if (media.fillRatio) {
      button.classList.add("project-media-fill");
      button.dataset.fillRatio = String(media.fillRatio);
    }
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
      () => {
        button.classList.add("media-loaded");
        syncMediaBox(button, image);
      },
      { once: true },
    );
    image.dataset.src = getImageSource(media.src);
    button.appendChild(image);
    return button;
  }

  function snapToDevicePixel(value) {
    const pixelRatio = window.devicePixelRatio || 1;
    return Math.round(value * pixelRatio) / pixelRatio;
  }

  function setTrackScrollLeft(track, value) {
    track.scrollLeft = snapToDevicePixel(value);
  }

  function syncMediaBox(wrapper, media) {
    const track = wrapper.closest(".project-track");
    if (!track) return;

    const height = track.getBoundingClientRect().height;
    const isVideo = media instanceof HTMLVideoElement;
    const intrinsicWidth = isVideo
      ? media.videoWidth || media.width
      : media.naturalWidth || media.width;
    const intrinsicHeight = isVideo
      ? media.videoHeight || media.height
      : media.naturalHeight || media.height;
    if (!height || !intrinsicWidth || !intrinsicHeight) return;

    const aspectRatio =
      Number(wrapper.dataset.fillRatio) || intrinsicWidth / intrinsicHeight;
    const width = snapToDevicePixel(height * aspectRatio);

    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.aspectRatio = String(aspectRatio);
  }

  function syncTrackGeometry() {
    document.querySelectorAll(".project-track").forEach((track) => {
      // Reset first so responsive CSS can supply the new intended height.
      track.style.height = "";
      const height = snapToDevicePixel(track.getBoundingClientRect().height);
      track.style.height = `${height}px`;
      Array.from(track.children).forEach((item) => {
        if (
          !item.matches(".project-cover, .project-media") ||
          !item.querySelector("img, video")
        ) {
          return;
        }
        syncMediaBox(item, item.querySelector("img, video"));
      });
    });
  }

  function requestMediaGeometrySync() {
    if (mediaGeometryFrame !== null) return;
    mediaGeometryFrame = window.requestAnimationFrame(() => {
      mediaGeometryFrame = null;
      syncTrackGeometry();
    });
  }

  function createVideo(project, media, mediaIndex) {
    const wrapper = document.createElement("div");
    const video = document.createElement("video");
    const placeholder =
      window.PROJECT_PLACEHOLDERS?.[media.src] ||
      window.PROJECT_PLACEHOLDERS?.[media.poster];
    const dimensions = getMediaDimensions(media);

    wrapper.className = "project-media project-media-video";
    if (mediaIndex === 0) wrapper.classList.add("project-media-cover-video");
    if (media.unmute) wrapper.classList.add("video-unmute");
    if (media.longVideo) wrapper.classList.add("video-long");
    wrapper.addEventListener("click", (event) => handleMediaClick(event, project));
    if (placeholder) {
      wrapper.style.setProperty("--project-placeholder", `url("${placeholder}")`);
    }
    video.muted = true;
    video.draggable = false;
    video.loop = true;
    video.playsInline = true;
    if (dimensions) {
      video.width = dimensions[0];
      video.height = dimensions[1];
      wrapper.dataset.fillRatio = String(
        project.slug === "capsule-plaza" && mediaIndex === 0
          ? 3 / 2
          : dimensions[0] / dimensions[1],
      );
    }
    video.addEventListener(
      "loadedmetadata",
      () => {
        // A mobile derivative can have a subtly different aspect ratio from
        // its desktop source. Use the decoded file's own dimensions before it
        // is painted, so the wrapper and frame share one pixel grid.
        video.width = video.videoWidth;
        video.height = video.videoHeight;
        syncMediaBox(wrapper, video);
      },
      { once: true },
    );
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
    if (media.longVideo) {
      video.preload = "none";
      video.dataset.src = media.preview;
      video.dataset.longSrc = media.src;
    } else {
      video.preload = "none";
      video.dataset.src = getVideoSource(media);
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
    if (media.longVideo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "video-long-btn";
      button.textContent = "Watch full video";
      const resetLongVideo = () => {
        button.hidden = false;
        video.pause();
        video.controls = false;
        video.loop = true;
        video.muted = true;
        delete video.dataset.longLoaded;
        video.src = media.preview;
        video.load();
        if (video.dataset.inViewport === "true") {
          video.play().catch(() => {});
        }
      };
      const playLongVideo = () => {
        if (!video.dataset.longLoaded) {
          button.hidden = true;
          video.dataset.longLoaded = "true";
          video.pause();
          video.loop = false;
          video.muted = false;
          video.controls = true;
          video.src = video.dataset.longSrc;
          video.load();
        }
        video.play().catch(() => {});
      };

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        playLongVideo();
        video.requestFullscreen?.().catch(() => {});
      });
      document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement !== video && video.dataset.longLoaded) {
          resetLongVideo();
        }
      });
      video.addEventListener("webkitendfullscreen", () => {
        if (video.dataset.longLoaded) resetLongVideo();
      });
      video.addEventListener("ended", () => {
        if (video.dataset.longLoaded) resetLongVideo();
      });
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
    if (project.dimensions) {
      const dimensions = document.createElement("p");
      dimensions.className = "project-dimensions";
      dimensions.textContent = project.dimensions;
      details.appendChild(dimensions);
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
        if (event.target.closest(":is(.video-unmute-btn, .video-long-btn)")) return;
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
      if (event.target.closest(":is(.video-unmute-btn, .video-long-btn)")) return;
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
      setTrackScrollLeft(track, mouseDrag.startScrollLeft - distance);
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

  function setupProjectInfoCursor() {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const cursor = document.createElement("img");
    cursor.className = "project-info-cursor";
    cursor.src = "assets/shared/svg/info.svg";
    cursor.alt = "";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);

    const hide = () => cursor.classList.remove("is-visible");
    const show = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (event.target.closest(":is(.video-unmute-btn, .video-long-btn)")) {
        hide();
        return;
      }
      cursor.style.transform = `translate3d(${event.clientX - 9}px, ${event.clientY - 9}px, 0)`;
      cursor.classList.add("is-visible");
    };

    document
      .querySelectorAll(".project-track, .project-row > .project-cover")
      .forEach((target) => {
        target.addEventListener("pointerenter", show);
        target.addEventListener("pointermove", show, { passive: true });
        target.addEventListener("pointerleave", hide);
      });
  }

  function renderProjects() {
    projects.forEach((project, projectIndex) => {
      if (project.hidden) return;
      const row = document.createElement("section");
      const track = document.createElement("div");
      const cover = createCover(project, projectIndex);
      const details = createDetails(project);
      const isSingleImage =
        project.media.length === 1 && project.media[0]?.type === "image";
      row.className = `${project.categories.join(" ")} project-row`;
      row.dataset.projectSlug = project.slug;
      row.dataset.singleImage = String(isSingleImage);
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

      // Work is configured with every project open. Build that final DOM
      // before connecting the row, so a centered/closed cover is never
      // painted and then moved into its left-aligned track.
      if (openAllProjects) {
        openedRows.add(row);
        row.classList.add("project-open");
        list.classList.add("has-open-project");
        cover.setAttribute("aria-expanded", "true");
        if (!isSingleImage) {
          if (cover.dataset.mediaType !== "video") track.prepend(cover);
          row.classList.add("project-gallery-open");
          track.hidden = false;
        }
      }

      if (
        openAllProjects &&
        !isSingleImage &&
        cover.dataset.mediaType !== "video"
      ) {
        row.append(track, details);
      } else {
        row.append(cover, track, details);
      }
      if (openAllProjects && !isSingleImage) activateProjectImages(row);
      list.appendChild(row);
      rowsBySlug.set(project.slug, row);
    });
  }

  function setupEdgeScrolling() {
    // Two thirds of the previous 4 cm desktop activation area.
    const desktopEdgeSize = Math.round(((4 / 2.54) * 96 * 2) / 3);
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
      setTrackScrollLeft(
        edgeTrack,
        edgeTrack.scrollLeft + edgeDirection * edgeSpeed,
      );
      edgeFrame = window.requestAnimationFrame(scroll);
    }

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (mobileQuery.matches) {
        stop();
        return;
      }
      const edgeSize = desktopEdgeSize;
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
        setTrackScrollLeft(
          activeHint.track,
          activeHint.track.scrollLeft + movement,
        );
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
  syncTrackGeometry();
  window.addEventListener("resize", requestMediaGeometrySync, { passive: true });
  // A layout resize can happen without a reliable window resize event (for
  // example when a browser panel or the mobile viewport changes). Observe the
  // scroll container itself so every open track is measured again.
  if ("ResizeObserver" in window && scrollRoot) {
    new ResizeObserver(requestMediaGeometrySync).observe(scrollRoot);
  }
  if (location.hash && location.hash !== "#about") {
    const initialSlug = decodeURIComponent(location.hash.slice(1));
    const initialRow = rowsBySlug.get(initialSlug);
    if (initialRow) focusProject(initialRow);
    else removeHash();
  }
  setupEdgeScrolling();
  setupVerticalScrollHints();
  setupVideoLoading();
  signalCoversReady();

  window.closeProjectDetails = () => {
    if (openAllProjects) return;
    openedRows.forEach((row) => closeProject(row, false));
    removeHash();
  };
  window.addEventListener("hashchange", () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (slug === "about") return;
    if (rowsBySlug.has(slug)) openProject(slug, false);
    else removeHash();
  });
})();
