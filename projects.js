(() => {
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const list = document.getElementById("projects-list");
  let activeSlug = null;

  function removeHash() {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  function setHash(slug) {
    history.replaceState(null, "", `#${encodeURIComponent(slug)}`);
  }

  function updateOpenProject(slug, shouldWriteHash) {
    const nextSlug = activeSlug === slug ? null : slug;

    document.querySelectorAll(".project-row").forEach((row) => {
      const isActive = row.dataset.projectSlug === nextSlug;
      const details = row.querySelector(".project-details");
      row.querySelectorAll(".project-media-image").forEach((button) => {
        button.setAttribute("aria-pressed", String(isActive));
      });
      details.hidden = !isActive;
    });

    activeSlug = nextSlug;

    if (!shouldWriteHash) return;
    if (nextSlug) setHash(nextSlug);
    else removeHash();
  }

  function createImage(project, media, projectIndex, mediaIndex) {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const isPriority = mediaIndex === 0 && projectIndex < 3;

    button.type = "button";
    button.className = "project-media project-media-image";
    button.setAttribute("aria-label", `Show information for ${project.title}`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => updateOpenProject(project.slug, true));

    image.src = media.src;
    image.alt = "";
    image.decoding = "async";
    image.loading = isPriority ? "eager" : "lazy";
    if (projectIndex === 0 && mediaIndex === 0) image.fetchPriority = "high";

    button.appendChild(image);
    return button;
  }

  function createVideo(project, media) {
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
    if (media.poster) video.poster = media.poster;
    source.dataset.src = media.src;
    video.appendChild(source);
    wrapper.addEventListener("click", () => {
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

    project.info.forEach((line) => {
      const info = document.createElement("p");
      info.className = "project-info";
      info.textContent = line;
      details.appendChild(info);
    });

    if (project.description) {
      const description = document.createElement("p");
      description.className = "project-description";
      description.textContent = project.description;
      details.appendChild(description);
    }

    return details;
  }

  function loadVideo(video) {
    const source = video.querySelector("source[data-src]");
    if (!source || source.src) return;
    source.src = source.dataset.src;
    video.preload = "metadata";
    video.load();
  }

  function observeVideos() {
    const videos = document.querySelectorAll(".project-media video");
    if (!("IntersectionObserver" in window)) {
      videos.forEach(loadVideo);
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
      { rootMargin: "300px" },
    );

    videos.forEach((video) => observer.observe(video));
  }

  function renderProjects() {
    projects.forEach((project, projectIndex) => {
      const row = document.createElement("section");
      const track = document.createElement("div");

      row.className = `${project.categories.join(" ")} project-row`;
      row.dataset.projectSlug = project.slug;
      track.className = "project-track";
      track.setAttribute("aria-label", `${project.title} media`);

      project.media.forEach((media, mediaIndex) => {
        const mediaElement =
          media.type === "video"
            ? createVideo(project, media)
            : createImage(project, media, projectIndex, mediaIndex);
        track.appendChild(mediaElement);
      });

      row.append(track, createDetails(project));
      list.appendChild(row);
    });
  }

  renderProjects();
  observeVideos();

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
    updateOpenProject(initialSlug, false);
    document
      .querySelector(`[data-project-slug="${CSS.escape(initialSlug)}"]`)
      .scrollIntoView({ block: "start", behavior: "auto" });
  }

  window.addEventListener("hashchange", () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (projects.some((project) => project.slug === slug)) {
      updateOpenProject(slug, false);
    } else if (activeSlug) {
      updateOpenProject(activeSlug, false);
    }
  });
})();
