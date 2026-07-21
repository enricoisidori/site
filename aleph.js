(function () {
  const isProjectsPage = document.body.classList.contains("projects-page");
  const workMode = document.body.dataset.alephWorkMode || "full";
  const ALEPH_BACKGROUND_ENABLED =
    document.body.dataset.alephBackground !== "off" &&
    !(isProjectsPage && workMode === "off");
  if (!ALEPH_BACKGROUND_ENABLED) {
    document.documentElement.dataset.alephDisabled = "true";
    document.documentElement.style.setProperty("--aleph-cached-bg", "none");
    document.body.classList.add("white-bg");
    const disabledStage = document.getElementById("aleph-stage");
    if (disabledStage) disabledStage.style.display = "none";
    return;
  }

  const mobileViewport = window.matchMedia("(max-width: 768px)");
  if (mobileViewport.matches && screen.orientation?.lock) {
    const lockPortrait = () => {
      screen.orientation.lock("portrait").catch(() => {});
    };
    lockPortrait();
    document.addEventListener("touchstart", lockPortrait, {
      once: true,
      passive: true,
    });
  }

  const stage = document.getElementById("aleph-stage");
  const contentScroll = document.getElementById("content-scroll");
  const canvas = document.getElementById("aleph-canvas");
  if (!stage || !contentScroll || !canvas) return;

  contentScroll.prepend(stage);

  const root = document.documentElement;
  // A new browsing session starts on Wikipedia; Work and About share its state.
  let whiteBg = sessionStorage.getItem("aleph_white_bg") === "1";
  function setBackground(isWhite) {
    whiteBg = isWhite;
    sessionStorage.setItem("aleph_white_bg", whiteBg ? "1" : "0");
    stage.style.display = whiteBg ? "none" : "";
    document.body.classList.toggle("white-bg", whiteBg);
    if (!whiteBg) scheduleAlephStart();
    root.style.setProperty(
      "--root-bg-image",
      whiteBg || !imgCurrent ? "none" : `url("${imgCurrent.src}")`,
    );
  }

  function toggleBackground() {
    setBackground(!whiteBg);
  }

  if (whiteBg) { stage.style.display = "none"; document.body.classList.add("white-bg"); }
  document.body.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    if (e.target.closest("button")) return;
    if (e.target.closest(".btn")) return;
    if (e.target.closest(".video-unmute")) return;
    toggleBackground();
  });

  function getScrollY() {
    return contentScroll?.scrollTop || 0;
  }

  function syncRootBackgroundImage(img) {
    const backgroundImage = img?.src ? `url("${img.src}")` : "none";
    root.style.setProperty(
      "--root-bg-image",
      backgroundImage,
    );
    root.style.setProperty("--aleph-cached-bg", backgroundImage);
  }

  const ctx = canvas.getContext("2d");

  const CW = 480,
    CH = 270;
  canvas.width = CW;
  canvas.height = CH;

  const off = document.createElement("canvas");
  off.width = CW;
  off.height = CH;
  const offCtx = off.getContext("2d", { willReadFrequently: true });

  const TRANSITION_PX = 250;
  const FEATHER = 0.12;
  const LUMA_INVERT = false;
  const COMMONS_FETCH_TIMEOUT = 8000;

  const lightWorkMode = isProjectsPage && workMode === "light";
  const maxBuffer = lightWorkMode ? 4 : 12;
  let commonsRefillEnabled = false;

  const Commons = {
    thumbWidth: 128,
    urlsQueue: [],
    prefetching: false,
    minBuffer: lightWorkMode ? 2 : 6,
    preloaded: [],
    loadingCount: 0,
    maxConcurrent: lightWorkMode ? 1 : 3,
    maxPool: lightWorkMode ? 5 : 16,
    heldIds: new Set(),
    seenIds: new Set(),
    seenOrder: [],
    seenCap: 50000,
  };

  function addSeen(id) {
    if (!id) return;
    if (!Commons.seenIds.has(id)) {
      Commons.seenIds.add(id);
      Commons.seenOrder.push(id);
      if (Commons.seenOrder.length > Commons.seenCap) {
        Commons.seenIds.delete(Commons.seenOrder.shift());
      }
    }
  }

  function commonsApiUrl(n, width) {
    const base = "https://commons.wikimedia.org/w/api.php";
    const p = new URLSearchParams({
      action: "query",
      generator: "random",
      grnnamespace: "6",
      grnlimit: String(n),
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: String(width),
      format: "json",
      origin: "*",
    });
    return `${base}?${p.toString()}`;
  }

  async function fetchCommonsUrls(n) {
    if (Commons.prefetching) return;
    Commons.prefetching = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      COMMONS_FETCH_TIMEOUT,
    );
    try {
      const res = await fetch(commonsApiUrl(n, Commons.thumbWidth), {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Commons request failed: ${res.status}`);
      const data = await res.json();
      const pages = data?.query?.pages || {};
      const urls = [];
      for (const k in pages) {
        const title = pages[k]?.title || String(pages[k]?.pageid || "");
        const info = pages[k]?.imageinfo?.[0];
        const u = info?.thumburl || info?.url;
        const mime = info?.mime || "";
        if (!title || !u || !mime.startsWith("image/")) continue;
        if (Commons.seenIds.has(title) || Commons.heldIds.has(title)) continue;
        urls.push({ id: title, url: u });
        Commons.heldIds.add(title);
      }
      Commons.urlsQueue.push(...urls);
    } catch (e) {
      if (e.name !== "AbortError") console.warn("Commons fetch failed", e);
    } finally {
      window.clearTimeout(timeout);
      Commons.prefetching = false;
    }
  }

  async function ensureCommonsBuffer(n) {
    if (Commons.urlsQueue.length >= n) return;
    await fetchCommonsUrls(Math.max(Commons.minBuffer, n));
  }

  function pumpPreload() {
    while (
      Commons.preloaded.length < Commons.maxPool &&
      Commons.loadingCount < Commons.maxConcurrent &&
      Commons.urlsQueue.length > 0
    ) {
      const { id, url } = Commons.urlsQueue.shift();
      const im = new Image();
      im.crossOrigin = "anonymous";
      Commons.loadingCount++;
      im.onload = () => {
        Commons.preloaded.push({ id, img: im });
        if (Commons.preloaded.length > Commons.maxPool)
          Commons.preloaded.shift();
        Commons.loadingCount--;
        pumpPreload();
        if (!imgNext && imgCurrent) prepareNextImage();
      };
      im.onerror = () => {
        if (id) Commons.heldIds.delete(id);
        Commons.loadingCount--;
        pumpPreload();
        if (Commons.urlsQueue.length === 0 && Commons.loadingCount === 0) {
          fetchCommonsUrls(Commons.minBuffer).then(() => pumpPreload());
        }
      };
      im.src = url;
    }
  }

  let imgCurrent = null;
  let imgNext = null;
  let pixA = null;
  let pixB = null;

  let transitionProgress = 0;
  let scrollAccum = 0;
  let lastScrollY = 0;
  let rafPending = false;

  function drawImageCover(targetCtx, img, width, height) {
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) return;

    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  function getPixData(img) {
    drawImageCover(offCtx, img, CW, CH);
    return offCtx.getImageData(0, 0, CW, CH);
  }

  function renderFrame() {
    rafPending = false;
    if (!imgCurrent) return;

    if (!imgNext || transitionProgress <= 0) {
      drawImageCover(ctx, imgCurrent, CW, CH);
      return;
    }

    const A = pixA.data,
      B = pixB.data;
    const out = ctx.createImageData(CW, CH);
    const d = out.data;
    const t = transitionProgress;

    for (let i = 0; i < A.length; i += 4) {
      const luma =
        (0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]) / 255;
      const key = LUMA_INVERT ? 1 - luma : luma;

      let alpha = (t - key) / FEATHER + 0.5;
      if (alpha < 0) alpha = 0;
      else if (alpha > 1) alpha = 1;
      const ia = 1 - alpha;

      d[i] = A[i] * ia + B[i] * alpha;
      d[i + 1] = A[i + 1] * ia + B[i + 1] * alpha;
      d[i + 2] = A[i + 2] * ia + B[i + 2] * alpha;
      d[i + 3] = 255;
    }

    ctx.putImageData(out, 0, 0);

    if (transitionProgress >= 1) {
      imgCurrent = imgNext;
      saveCached(imgCurrent);
      if (!whiteBg) syncRootBackgroundImage(imgCurrent);
      pixA = pixB;
      imgNext = null;
      pixB = null;
      transitionProgress = 0;
      scrollAccum = 0;
      prepareNextImage();
    }
  }

  function scheduleRender() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(renderFrame);
    }
  }

  function prepareNextImage() {
    if (imgNext) return;
    if (Commons.preloaded.length === 0) {
      if (
        commonsRefillEnabled &&
        Commons.urlsQueue.length < Commons.minBuffer
      )
        ensureCommonsBuffer(maxBuffer);
      pumpPreload();
      return;
    }
    const frame = Commons.preloaded.shift();
    if (!frame || !frame.img) return;
    imgNext = frame.img;
    pixB = getPixData(imgNext);
    if (frame.id) {
      Commons.heldIds.delete(frame.id);
      addSeen(frame.id);
    }
    if (
      commonsRefillEnabled &&
      Commons.urlsQueue.length < Math.floor(maxBuffer / 2)
    )
      ensureCommonsBuffer(maxBuffer);
    pumpPreload();
  }

  function saveCached(img) {
    try {
      localStorage.setItem("aleph_last_url", img.src);
    } catch (_) {}
  }

  function persistCommonsBuffer() {
    try {
      const frames = [];
      const urls = new Set();
      const addFrame = (id, url) => {
        if (!url || urls.has(url) || frames.length >= maxBuffer) return;
        urls.add(url);
        frames.push({ id: id || "", url });
      };

      addFrame("", imgNext?.src);
      Commons.preloaded.forEach((frame) => addFrame(frame.id, frame.img?.src));
      Commons.urlsQueue.forEach((frame) => addFrame(frame.id, frame.url));
      sessionStorage.setItem("aleph_buffer", JSON.stringify(frames));
    } catch (_) {}
  }

  function restoreCommonsBuffer() {
    try {
      const raw = sessionStorage.getItem("aleph_buffer");
      if (!raw) return;
      const frames = JSON.parse(raw);
      if (!Array.isArray(frames)) return;

      const queued = new Set(Commons.urlsQueue.map((frame) => frame.url));
      frames.slice(0, maxBuffer).forEach((frame) => {
        if (!frame?.url || queued.has(frame.url)) return;
        Commons.urlsQueue.push({ id: frame.id || "", url: frame.url });
        if (frame.id) Commons.heldIds.add(frame.id);
        queued.add(frame.url);
      });
    } catch (_) {}
  }

  function persistSeenIds() {
    try {
      const arr = Array.from(Commons.seenIds).slice(-200);
      localStorage.setItem("aleph_seen_ids", JSON.stringify(arr));
    } catch (_) {}
  }

  function restoreSeenIds() {
    try {
      const raw = localStorage.getItem("aleph_seen_ids");
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) for (const id of arr) addSeen(id);
    } catch (_) {}
  }

  function bootFromCache() {
    const lastUrl = localStorage.getItem("aleph_last_url");
    if (!lastUrl) return Promise.resolve(false);
    return new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => {
        try {
          imgCurrent = im;
          pixA = getPixData(imgCurrent);
          drawImageCover(ctx, imgCurrent, CW, CH);
          if (!whiteBg) syncRootBackgroundImage(imgCurrent);
          resolve(true);
        } catch (_) {
          resolve(false);
        }
      };
      im.onerror = () => resolve(false);
      im.src = lastUrl;
    });
  }

  async function initFirstImage() {
    while (Commons.preloaded.length === 0) {
      if (
        Commons.urlsQueue.length === 0 &&
        Commons.loadingCount === 0 &&
        !Commons.prefetching
      ) {
        await fetchCommonsUrls(Commons.minBuffer);
        pumpPreload();
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const frame = Commons.preloaded.shift();
    if (frame && frame.img) {
      if (!imgCurrent) {
        imgCurrent = frame.img;
        pixA = getPixData(imgCurrent);
        drawImageCover(ctx, imgCurrent, CW, CH);
        saveCached(imgCurrent);
        if (!whiteBg) syncRootBackgroundImage(imgCurrent);
      } else {
        imgNext = frame.img;
        pixB = getPixData(imgNext);
      }
      if (frame.id) {
        Commons.heldIds.delete(frame.id);
        addSeen(frame.id);
      }
    }
    prepareNextImage();
  }

  function onScroll() {
    const sy = getScrollY();
    const delta = Math.abs(sy - lastScrollY);
    lastScrollY = sy;
    if (!imgCurrent) return;
    if (!imgNext) {
      prepareNextImage();
      return;
    }
    scrollAccum += delta;
    transitionProgress = Math.min(scrollAccum / TRANSITION_PX, 1);
    scheduleRender();
  }

  let alephStarted = false;
  let alephStartScheduled = false;

  function signalAlephReady() {
    if (window.__alephReady) return;
    window.__alephReady = true;
    root.dataset.alephReady = "true";
    window.dispatchEvent(new Event("aleph:ready"));
  }

  async function startAleph() {
    if (alephStarted) return;
    alephStarted = true;
    restoreSeenIds();
    restoreCommonsBuffer();

    Commons.thumbWidth = 64;

    const cacheBoot = bootFromCache();
    const initialBuffer = lightWorkMode ? 1 : isProjectsPage ? 3 : 2;
    const missingUrls = Math.max(initialBuffer - Commons.urlsQueue.length, 0);
    const commonsBoot = missingUrls
      ? fetchCommonsUrls(missingUrls)
      : Promise.resolve();
    const fromCache = await cacheBoot;

    if (fromCache) {
      signalAlephReady();
      commonsBoot.then(() => {
        pumpPreload();
        initFirstImage();
      });
    } else {
      await commonsBoot;
      pumpPreload();
      await initFirstImage();

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, CW, CH);

      let start = performance.now();
      const duration = 1000;

      function lumaIntro(t) {
        const p = Math.min((t - start) / duration, 1);

        const out = ctx.createImageData(CW, CH);
        const d = out.data;
        const A = pixA.data;

        for (let i = 0; i < A.length; i += 4) {
          const luma =
            (0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]) / 255;

          let alpha = (p - luma) / 0.15 + 0.5;
          if (alpha < 0) alpha = 0;
          if (alpha > 1) alpha = 1;

          d[i] = 255 * (1 - alpha) + A[i] * alpha;
          d[i + 1] = 255 * (1 - alpha) + A[i + 1] * alpha;
          d[i + 2] = 255 * (1 - alpha) + A[i + 2] * alpha;
          d[i + 3] = 255;
        }

        ctx.putImageData(out, 0, 0);

        if (p < 1) requestAnimationFrame(lumaIntro);
        else signalAlephReady();
      }

      requestAnimationFrame(lumaIntro);
    }

    commonsRefillEnabled = true;
    Commons.thumbWidth = 128;
    ensureCommonsBuffer(maxBuffer).then(() => pumpPreload());

    // Persisti seen IDs periodicamente e all'unload
    setInterval(persistSeenIds, 4000);
    window.addEventListener("pagehide", () => {
      persistSeenIds();
      persistCommonsBuffer();
    });
  }

  function scheduleAlephStart() {
    if (alephStarted || alephStartScheduled) return;

    const start = () => {
      alephStartScheduled = false;
      startAleph();
    };

    if (isProjectsPage && !window.__portfolioPriorityReady) {
      alephStartScheduled = true;
      window.addEventListener("portfolio:priority-ready", start, { once: true });
      return;
    }

    alephStartScheduled = true;
    start();
  }

  scheduleAlephStart();

  lastScrollY = getScrollY();
  contentScroll.addEventListener("scroll", onScroll, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleRender();
  });
})();
