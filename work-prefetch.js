(function () {
  if (!document.body.classList.contains("about-page")) return;

  const workLink = document.querySelector(
    '.about-navigation .page-link[href="work.html"]',
  );
  if (!workLink) return;

  let warming = false;

  function sourceForViewport(src) {
    if (
      window.matchMedia("(max-width: 768px)").matches &&
      src.endsWith(".webp")
    ) {
      return src.replace(/\.webp$/, "-mobile.webp");
    }
    return src;
  }

  function loadProjectData() {
    if (Array.isArray(window.PROJECTS)) return Promise.resolve(window.PROJECTS);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "projects-data.js";
      script.onload = () => resolve(window.PROJECTS || []);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function warmWork() {
    if (warming) return;
    warming = true;
    loadProjectData()
      .then((projects) => {
        // Warm five items distributed across the first three projects. The
        // rest stays demand-loaded, so About does not download the archive.
        const mediaToWarm = projects
          .slice(0, 3)
          .flatMap((project) => project.media?.slice(0, 2) || [])
          .slice(0, 5);
        mediaToWarm.forEach((media) => {
          const src = media.src;
          if (!src) return;
          const source = sourceForViewport(src);
          if (media.type === "video") {
            const preload = document.createElement("link");
            preload.rel = "preload";
            preload.as = "video";
            preload.href = source;
            document.head.appendChild(preload);
            return;
          }
          const image = new Image();
          image.decoding = "async";
          image.fetchPriority = "low";
          image.src = source;
        });
      })
      .catch(() => {});
  }

  workLink.addEventListener("pointerenter", warmWork, { once: true });
  workLink.addEventListener("focus", warmWork, { once: true });
  workLink.addEventListener("pointerdown", warmWork, { once: true });
})();
