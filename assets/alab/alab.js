(() => {
  const navLinks = [...document.querySelectorAll("[data-nav-link]")];
  const sections = [...document.querySelectorAll("[data-section]")];
  const SCROLL_HINT_RATIO = 0.5;
  const SCROLL_HINT_SCROLL_FACTOR = 1;

  const setActiveSection = (id) => {
    navLinks.forEach((link) => {
      const isActive = link.hash === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const updateActiveOnScroll = () => {
    const atPageEnd =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2;

    if (atPageEnd) {
      setActiveSection(sections.at(-1).id);
      return;
    }

    const header = document.querySelector(".site-header");
    const probe = window.scrollY + header.offsetHeight + 10;
    const activeSections = sections.filter((section) => section.offsetTop <= probe);
    const current = activeSections.at(-1);
    setActiveSection(current?.dataset.navSection || current?.id || null);
  };

  let scrollFrame = null;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        updateActiveOnScroll();
        scrollFrame = null;
      });
    },
    { passive: true },
  );

  updateActiveOnScroll();

  document.querySelectorAll("[data-disclosure]").forEach((disclosure) => {
    const button = disclosure.querySelector("[data-disclosure-toggle]");
    const extraItems = [...disclosure.querySelectorAll("[data-extra]")];
    if (!button || !extraItems.length) return;

    const collapsedLabel = button.textContent.trim();

    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      extraItems.forEach((item) => {
        item.hidden = isExpanded;
      });
      button.setAttribute("aria-expanded", String(!isExpanded));

      if (collapsedLabel === "See more") {
        button.textContent = isExpanded ? "See more" : "See less";
      } else if (collapsedLabel === "[…]") {
        button.textContent = isExpanded ? "[…]" : "[close]";
      }
    });
  });

  const carouselTracks = [...document.querySelectorAll("[data-infinite-carousel]")];

  const makeLoopClone = (item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    if (clone.matches("a, button, input, select, textarea, [tabindex]")) {
      clone.setAttribute("tabindex", "-1");
    }
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((node) => {
      node.setAttribute("tabindex", "-1");
    });
    return clone;
  };

  const setupInfiniteCarousel = (track) => {
    const originals = [...track.children];
    if (originals.length < 2) return;

    const leading = document.createDocumentFragment();
    const trailing = document.createDocumentFragment();
    originals.forEach((item) => {
      leading.append(makeLoopClone(item));
      trailing.append(makeLoopClone(item));
    });
    track.prepend(leading);
    track.append(trailing);

    const firstLeadingClone = track.firstElementChild;
    const firstOriginal = originals[0];
    const getLoopWidth = () =>
      firstOriginal.offsetLeft - firstLeadingClone.offsetLeft;
    const jumpTo = (left) => {
      track.classList.add("is-loop-jump");
      track.scrollLeft = left;
      requestAnimationFrame(() => track.classList.remove("is-loop-jump"));
    };

    requestAnimationFrame(() => jumpTo(getLoopWidth()));

    let loopFrame = null;
    track.addEventListener(
      "scroll",
      () => {
        if (loopFrame !== null) return;
        loopFrame = requestAnimationFrame(() => {
          loopFrame = null;
          const loopWidth = getLoopWidth();
          if (track.scrollLeft < loopWidth * 0.5) {
            jumpTo(track.scrollLeft + loopWidth);
          } else if (track.scrollLeft > loopWidth * 1.5) {
            jumpTo(track.scrollLeft - loopWidth);
          }
        });
      },
      { passive: true },
    );

    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragging = false;
    let didDrag = false;

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      didDrag = false;
      dragStartX = event.clientX;
      dragStartScroll = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    });

    track.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      if (Math.abs(event.clientX - dragStartX) > 4) didDrag = true;
      track.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    });

    track.addEventListener(
      "click",
      (event) => {
        if (!didDrag) return;
        event.preventDefault();
        event.stopPropagation();
        didDrag = false;
      },
      true,
    );

    const stopDragging = (event) => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-dragging");
      if (track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
    };

    track.addEventListener("pointerup", stopDragging);
    track.addEventListener("pointercancel", stopDragging);

    new ResizeObserver(() => jumpTo(getLoopWidth())).observe(track);
  };

  carouselTracks.forEach(setupInfiniteCarousel);

  const setupVerticalScrollHints = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let nextTrackIndex = 0;
    let activeHint = null;
    let lastScrollTop = window.scrollY;
    let hintsDisabled = false;
    let scrollHintFrame = null;

    const updateScrollHints = () => {
      scrollHintFrame = null;
      let scrollDelta = window.scrollY - lastScrollTop;
      lastScrollTop = window.scrollY;
      if (scrollDelta < 0) hintsDisabled = true;
      if (hintsDisabled || scrollDelta <= 0) return;

      while (scrollDelta > 0 && nextTrackIndex < carouselTracks.length) {
        if (!activeHint) {
          const track = carouselTracks[nextTrackIndex];
          const rect = track.getBoundingClientRect();
          if (rect.top > window.innerHeight * 0.85) return;
          nextTrackIndex += 1;
          if (rect.bottom <= 0) continue;

          const firstItem = track.children[0];
          const maxScroll = track.scrollWidth - track.clientWidth;
          const hintDistance = Math.min(
            (firstItem?.getBoundingClientRect().width || 0) * SCROLL_HINT_RATIO,
            maxScroll,
          );
          if (hintDistance <= 1) continue;
          activeHint = {
            track,
            target: track.scrollLeft + hintDistance,
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
    };

    window.addEventListener(
      "scroll",
      () => {
        if (scrollHintFrame === null) {
          scrollHintFrame = requestAnimationFrame(updateScrollHints);
        }
      },
      { passive: true },
    );
  };

  setupVerticalScrollHints();

  const languageSwitch = document.querySelector(".language-switch");
  languageSwitch?.addEventListener("click", () => {
    const showsItalianOption = languageSwitch.textContent.trim() === "ITA";
    const nextOption = showsItalianOption ? "ENG" : "ITA";
    languageSwitch.textContent = nextOption;
    languageSwitch.setAttribute("aria-pressed", String(showsItalianOption));
    languageSwitch.setAttribute(
      "aria-label",
      nextOption === "ITA" ? "Passa all’italiano" : "Switch to English",
    );
    languageSwitch.blur();
  });
})();
