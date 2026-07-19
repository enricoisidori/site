(() => {
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const list = document.getElementById("projects-list");
  let activeSlug = null;
  let priorityProjectRow = null;
  let priorityGeneration = 0;

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

  function updateOpenProject(slug, shouldWriteHash) {
    const nextSlug = activeSlug === slug ? null : slug;

    document.querySelectorAll(".project-row").forEach((row) => {
      const isActive = row.dataset.projectSlug === nextSlug;
      const details = row.querySelector(".project-details");
      row.querySelectorAll(".project-cover, .project-media-image").forEach((button) => {
        button.setAttribute("aria-pressed", String(isActive));
      });
      details.hidden = !isActive;
    });

    activeSlug = nextSlug;

    if (!shouldWriteHash) return;
    if (nextSlug) setHash(nextSlug);
    else removeHash();
  }

  function openProjectGallery(slug, shouldWriteHash) {
    const row = document.querySelector(
      `[data-project-slug="${CSS.escape(slug)}"]`,
    );
    if (!row) return;

    if (!row.classList.contains("project-gallery-open")) {
      const track = row.querySelector(".project-track");
      const cover = row.querySelector(".project-cover");
      const coverWidth = cover?.getBoundingClientRect().width || 0;

      if (cover) track.prepend(cover);
      row.classList.add("project-gallery-open");
      track.hidden = false;
      cover?.setAttribute("aria-expanded", "true");
      cover?.setAttribute(
        "aria-label",
        `Show information for ${projects.find((project) => project.slug === slug)?.title || slug}`,
      );
      prioritizeProject(row, true);

      window.requestAnimationFrame(() => {
        track.scrollLeft = coverWidth / 2;
      });
    }

    if (activeSlug !== slug) updateOpenProject(slug, shouldWriteHash);
    else if (shouldWriteHash) setHash(slug);
  }

  window.closeProjectDetails = () => {
    if (!activeSlug) return;
    updateOpenProject(activeSlug, true);
  };

  function getMobileAsset(src) {
    return src.endsWith(".webp") ? src.replace(/\.webp$/, "-mobile.webp") : null;
  }

  function getResponsiveVideoAsset(src) {
    if (!window.matchMedia("(max-width: 768px)").matches) return src;
    if (src.endsWith("-optimized.mp4")) {
      return src.replace(/-optimized\.mp4$/, "-mobile.mp4");
    }
    return src.endsWith(".mp4") ? src.replace(/\.mp4$/, "-mobile.mp4") : src;
  }

  function createCover(project, projectIndex) {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const picture = document.createElement("picture");
    const firstMedia = project.media[0];
    const src = firstMedia.type === "video" ? firstMedia.poster : firstMedia.src;
    const mobileSrc = getMobileAsset(src);
    const isEager = projectIndex < 2;
    const isPriority = projectIndex === 0;
    const placeholder = window.PROJECT_PLACEHOLDERS?.[src];

    button.type = "button";
    button.className = "project-cover";
    button.setAttribute("aria-label", `Open ${project.title}`);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.closest(".project-row")?.classList.contains("project-gallery-open")) {
        updateOpenProject(project.slug, true);
        return;
      }
      openProjectGallery(project.slug, true);
    });

    image.alt = "";
    image.decoding = "async";
    image.loading = isEager ? "eager" : "lazy";
    image.width = 1500;
    image.height = 1000;
    image.fetchPriority = isPriority ? "high" : isEager ? "auto" : "low";
    if (isPriority) image.dataset.priority = "true";

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
      if (isEager) mobileSource.srcset = mobileSrc;
      else mobileSource.dataset.srcset = mobileSrc;
      picture.appendChild(mobileSource);
    }
    if (isEager) image.src = src;
    else image.dataset.src = src;
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
    button.setAttribute("aria-label", `Show information for ${project.title}`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      updateOpenProject(project.slug, true);
    });

    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    if (media.width && media.height) {
      image.width = media.width;
      image.height = media.height;
    }
    image.fetchPriority = "low";

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

  function createVideo(project, media, projectIndex, mediaIndex) {
    const wrapper = document.createElement("div");
    const video = document.createElement("video");
    const source = document.createElement("source");

    wrapper.className = "project-media project-media-video";
    if (media.unmute) wrapper.classList.add("video-unmute");
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("loading", "lazy");
    if (mediaIndex < 2) {
      video.dataset.earlyVideo = "true";
      video.dataset.projectIndex = String(projectIndex);
      video.dataset.mediaPosition = String(mediaIndex + 1);
    }
    if (media.poster) {
      const mobilePoster = getMobileAsset(media.poster);
      video.dataset.poster =
        mobilePoster && window.matchMedia("(max-width: 768px)").matches
          ? mobilePoster
          : media.poster;
    }
    source.dataset.src = getResponsiveVideoAsset(media.src);
    video.appendChild(source);
    wrapper.addEventListener("click", (event) => {
      event.stopPropagation();
      updateOpenProject(project.slug, true);
    });
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

  function loadVideo(video) {
    const source = video.querySelector("source[data-src]");
    if (!source || source.src) return;
    if (video.dataset.poster) {
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
    source.src = source.dataset.src;
    video.preload = "metadata";
    video.load();
  }

  function loadImage(image) {
    if (!image.dataset.src) return;
    const picture = image.closest("picture");
    picture?.querySelectorAll("source[data-srcset]").forEach((source) => {
      source.srcset = source.dataset.srcset;
      delete source.dataset.srcset;
    });
    image.loading = "eager";
    image.src = image.dataset.src;
    delete image.dataset.src;
  }

  function prioritizeProject(row, force = false) {
    if (!row || (row === priorityProjectRow && !force)) return;

    if (row !== priorityProjectRow) {
      priorityProjectRow?.querySelectorAll("img").forEach((image) => {
        image.fetchPriority = "low";
      });
      priorityProjectRow?.removeAttribute("data-load-priority");
      priorityProjectRow = row;
      priorityProjectRow.dataset.loadPriority = "high";
    }
    priorityGeneration += 1;
    const generation = priorityGeneration;
    const galleryOpen = row.classList.contains("project-gallery-open");
    const images = galleryOpen
      ? row.querySelectorAll(".project-track img")
      : row.querySelectorAll(".project-cover img");

    images.forEach((image) => {
      image.fetchPriority = "high";
      loadImage(image);
    });

    if (!galleryOpen) return;

    row.querySelectorAll("video").forEach((video, index) => {
      window.setTimeout(() => {
        if (
          priorityProjectRow !== row ||
          priorityGeneration !== generation
        ) {
          return;
        }
        loadVideo(video);
      }, index * 180);
    });
  }

  function setupProjectLoadingPriority() {
    const scrollRoot = document.getElementById("content-scroll");
    const rows = Array.from(document.querySelectorAll(".project-row"));
    let frame = null;

    const update = () => {
      frame = null;
      const rootRect = scrollRoot.getBoundingClientRect();
      const focusY = rootRect.top + rootRect.height * 0.45;
      const visibleRows = rows.filter((row) => !row.hidden);
      const rowAtFocus = visibleRows.find((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top <= focusY && rect.bottom >= focusY;
      }) || visibleRows.reduce((closest, row) => {
        const rect = row.getBoundingClientRect();
        const distance = Math.min(
          Math.abs(focusY - rect.top),
          Math.abs(focusY - rect.bottom),
        );
        return !closest || distance < closest.distance
          ? { row, distance }
          : closest;
      }, null)?.row;

      if (rowAtFocus) prioritizeProject(rowAtFocus);
    };

    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    scrollRoot.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    document.querySelectorAll(".project-track").forEach((track) => {
      const prioritizeTrack = () => prioritizeProject(track.closest(".project-row"));
      track.addEventListener("scroll", prioritizeTrack, { passive: true });
      track.addEventListener("pointerdown", prioritizeTrack, { passive: true });
    });

    scheduleUpdate();
  }

  function observeImages() {
    const images = document.querySelectorAll("img[data-src]");
    if (!("IntersectionObserver" in window)) {
      images.forEach(loadImage);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          loadImage(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        root: document.getElementById("content-scroll"),
        rootMargin: "150% 100%",
      },
    );

    images.forEach((image) => observer.observe(image));
  }

  function observeVideoSet(videos, rootMargin) {
    if (!("IntersectionObserver" in window)) {
      videos.forEach((video, index) => {
        window.setTimeout(() => loadVideo(video), index * 250);
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          loadVideo(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        root: document.getElementById("content-scroll"),
        rootMargin,
      },
    );

    videos.forEach((video) => observer.observe(video));
  }

  function observeEarlyVideos() {
    observeVideoSet(
      document.querySelectorAll("video[data-early-video]"),
      "100% 100%",
    );
  }

  function observeDeferredVideos() {
    observeVideoSet(
      document.querySelectorAll(".project-media video:not([data-early-video])"),
      "50% 25%",
    );
  }

  function observeDeferredVideosWhenIdle() {
    const start = () => {
      const idle =
        window.requestIdleCallback ||
        ((callback) => window.setTimeout(callback, 500));

      idle(observeDeferredVideos, { timeout: 1500 });
    };

    const startAfterPriorityImages = () => {
      if (window.__portfolioPriorityReady) start();
      else window.addEventListener("portfolio:priority-ready", start, { once: true });
    };

    startAfterPriorityImages();
  }

  function signalPriorityImagesReady() {
    const priorityImages = document.querySelectorAll("img[data-priority]");
    const pending = Array.from(priorityImages, (image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    });

    Promise.all(pending).then(() => {
      window.__portfolioPriorityReady = true;
      window.dispatchEvent(new Event("portfolio:priority-ready"));
    });
  }

  function renderProjects() {
    projects.forEach((project, projectIndex) => {
      const row = document.createElement("section");
      const track = document.createElement("div");
      const cover = createCover(project, projectIndex);

      row.className = `${project.categories.join(" ")} project-row`;
      row.dataset.projectSlug = project.slug;
      track.className = "project-track";
      track.hidden = true;
      track.setAttribute("aria-label", `${project.title} media`);

      project.media.forEach((media, mediaIndex) => {
        if (mediaIndex === 0 && media.type === "image") return;
        const mediaElement =
          media.type === "video"
            ? createVideo(project, media, projectIndex, mediaIndex)
            : createImage(project, media);
        track.appendChild(mediaElement);
      });

      row.append(cover, track, createDetails(project));
      list.appendChild(row);
    });
  }

  renderProjects();
  setupProjectLoadingPriority();
  observeImages();
  observeEarlyVideos();
  signalPriorityImagesReady();
  observeDeferredVideosWhenIdle();

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
      if (edgeFrame !== null) cancelAnimationFrame(edgeFrame);
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
      edgeFrame = requestAnimationFrame(scroll);
    }

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;

      const track = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest?.(".project-track"))
        .find(Boolean);
      const distanceFromLeft = event.clientX;
      const distanceFromRight = window.innerWidth - event.clientX;
      const atLeft = distanceFromLeft <= edgeSize;
      const atRight = distanceFromRight <= edgeSize;

      if (!track || (!atLeft && !atRight)) {
        stop();
        return;
      }

      edgeTrack = track;
      edgeDirection = atLeft ? -1 : 1;
      const distance = atLeft ? distanceFromLeft : distanceFromRight;
      edgeSpeed = Math.max(1, ((edgeSize - distance) / edgeSize) * 10);
      if (edgeFrame === null) edgeFrame = requestAnimationFrame(scroll);
    });

    window.addEventListener("blur", stop);
  }

  setupEdgeScrolling();

  const initialSlug = decodeURIComponent(location.hash.slice(1));
  if (initialSlug && projects.some((project) => project.slug === initialSlug)) {
    localStorage.removeItem("selectedFilter");
    openProjectGallery(initialSlug, false);
    document
      .querySelector(`[data-project-slug="${CSS.escape(initialSlug)}"]`)
      .scrollIntoView({ block: "start", behavior: "auto" });
  }

  window.addEventListener("hashchange", () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (projects.some((project) => project.slug === slug)) {
      openProjectGallery(slug, false);
    } else if (activeSlug) {
      updateOpenProject(activeSlug, false);
    }
  });
})();
