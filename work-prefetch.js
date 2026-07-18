(function () {
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  if (!projects.length || document.body.classList.contains("projects-page")) return;

  const connection = navigator.connection;
  if (
    connection?.saveData ||
    ["slow-2g", "2g"].includes(connection?.effectiveType)
  ) {
    return;
  }

  const scriptUrl = document.currentScript?.src || window.location.href;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const firstImages = [];
  const remainingImages = [];

  projects.forEach((project) => {
    const images = project.media.filter((media) => media.type === "image");
    if (images[0]) firstImages.push(images[0].src);
    images.slice(1).forEach((media) => remainingImages.push(media.src));
  });

  const urls = Array.from(new Set([...firstImages, ...remainingImages])).map(
    (src) => {
      const responsiveSrc =
        mobile && src.endsWith(".webp")
          ? src.replace(/\.webp$/, "-mobile.webp")
          : src;
      return new URL(responsiveSrc, scriptUrl).href;
    },
  );

  const cursorKey = `work_prefetch_cursor_${mobile ? "mobile" : "desktop"}`;
  const storedCursor = Number.parseInt(sessionStorage.getItem(cursorKey), 10);
  let cursor = Number.isFinite(storedCursor)
    ? Math.min(Math.max(storedCursor, 0), urls.length)
    : 0;
  let running = false;
  let started = false;
  let timer = null;

  window.__workPrefetchProgress = { loaded: cursor, total: urls.length };
  document.documentElement.dataset.workPrefetchLoaded = String(cursor);
  document.documentElement.dataset.workPrefetchTotal = String(urls.length);

  function queueNext() {
    if (running || cursor >= urls.length || document.hidden || timer !== null) return;

    timer = window.setTimeout(() => {
      timer = null;
      const idle = window.requestIdleCallback || ((callback) => callback());
      idle(prefetchNext, { timeout: 3000 });
    }, 250);
  }

  async function prefetchNext() {
    if (running || cursor >= urls.length || document.hidden) return;

    running = true;
    const url = urls[cursor++];
    try {
      const response = await fetch(url, {
        cache: "force-cache",
        credentials: "same-origin",
        priority: "low",
      });
      if (response.ok) await response.blob();
    } catch (_) {
      // Il caricamento normale di Work resta il fallback.
    } finally {
      running = false;
      window.__workPrefetchProgress.loaded = cursor;
      document.documentElement.dataset.workPrefetchLoaded = String(cursor);
      sessionStorage.setItem(cursorKey, String(cursor));
      queueNext();
    }
  }

  function start() {
    if (started) return;
    started = true;
    queueNext();
  }

  if (window.__alephReady) start();
  else window.addEventListener("aleph:ready", start, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && started) queueNext();
  });
})();
