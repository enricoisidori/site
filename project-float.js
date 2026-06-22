(function () {
  const MAX_VISIBLE = 20;
  const PRELOAD_POOL = 16;
  const SPAWN_INTERVAL_MS = 1000;
  const MIN_SIZE_VW = 14;
  const MAX_SIZE_VW = 32;
  const MIN_SIZE_VW_MOBILE = 52;
  const MAX_SIZE_VW_MOBILE = 78;
  const CENTER_SPREAD_VW = 22;
  const CENTER_SPREAD_VW_MOBILE = 16;

  const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
  const VIDEO_RE = /\.(mp4|mov|webm)$/i;
  const PROJECT_ASSET_RE = /^[^/]+\/asset\/[^/]+$/i;
  const MOBILE_MQ = window.matchMedia("(max-width: 768px)");

  let manifest = [];
  let layer = null;
  let visible = [];
  let pool = [];
  let preloadTimer = null;
  let spawnInterval = null;
  let paused = false;
  let started = false;
  let initialSpawned = false;
  let zTop = 1;

  function sitePrefix() {
    const parts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /\.html?$/i.test(last)) parts.pop();
    return parts.length ? "../".repeat(parts.length) : "./";
  }

  function resolvePath(path) {
    return sitePrefix() + path;
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function isVideo(path) {
    return VIDEO_RE.test(path);
  }

  function isProjectAsset(path) {
    return PROJECT_ASSET_RE.test(path) && (IMAGE_RE.test(path) || VIDEO_RE.test(path));
  }

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = "project-float-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    return layer;
  }

  function trimVisible() {
    while (visible.length > MAX_VISIBLE) {
      const el = visible.shift();
      el.remove();
    }
  }

  function createMediaElement(path, preloaded) {
    if (isVideo(path)) {
      const video =
        preloaded instanceof HTMLVideoElement
          ? preloaded
          : document.createElement("video");
      if (!(preloaded instanceof HTMLVideoElement)) {
        video.src = resolvePath(path);
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = "auto";
      }
      video.removeAttribute("controls");
      return video;
    }

    const img =
      preloaded instanceof HTMLImageElement
        ? preloaded
        : document.createElement("img");
    if (!(preloaded instanceof HTMLImageElement)) {
      img.src = resolvePath(path);
      img.alt = "";
      img.decoding = "async";
    }
    img.draggable = false;
    return img;
  }

  function styleFloater(el) {
    const mobile = isMobile();
    const sizeVw = mobile
      ? randomBetween(MIN_SIZE_VW_MOBILE, MAX_SIZE_VW_MOBILE)
      : randomBetween(MIN_SIZE_VW, MAX_SIZE_VW);
    const spread = mobile ? CENTER_SPREAD_VW_MOBILE : CENTER_SPREAD_VW;
    const x = 50 + randomBetween(-spread, spread);
    const y = 50 + randomBetween(-spread, spread);
    el.style.width = `${sizeVw}vw`;
    el.classList.toggle("project-float-mobile", mobile);
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    zTop += 1;
    el.style.zIndex = String(zTop);
  }

  function spawnOne() {
    if (paused || !manifest.length) return;

    const readyIdx = pool.findIndex((item) => item.ready);
    let path;
    let media;

    if (readyIdx >= 0) {
      const item = pool.splice(readyIdx, 1)[0];
      path = item.path;
      media = createMediaElement(path, item.el);
    } else {
      path = randomItem(manifest);
      media = createMediaElement(path);
    }

    styleFloater(media);
    ensureLayer().appendChild(media);
    visible.push(media);
    trimVisible();

    if (media instanceof HTMLVideoElement) {
      media.play().catch(() => {});
    }
  }

  function beginAutoSpawn() {
    if (spawnInterval) return;
    spawnInterval = setInterval(() => {
      if (!paused && started) spawnOne();
    }, SPAWN_INTERVAL_MS);
  }

  function stopAutoSpawn() {
    if (spawnInterval) {
      clearInterval(spawnInterval);
      spawnInterval = null;
    }
  }

  function tryInitialSpawn() {
    if (initialSpawned || paused || document.body.classList.contains("white-bg")) return;
    if (!pool.some((item) => item.ready)) return;
    initialSpawned = true;
    started = true;
    spawnOne();
    beginAutoSpawn();
  }

  function preloadOne() {
    if (!manifest.length) return;
    const path = randomItem(manifest);
    const item = { path, ready: false, el: null };

    const markReady = () => {
      if (item.ready) return;
      item.ready = true;
      tryInitialSpawn();
    };

    if (isVideo(path)) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.addEventListener("canplaythrough", markReady, { once: true });
      video.addEventListener("loadeddata", markReady, { once: true });
      video.src = resolvePath(path);
      video.load();
      item.el = video;
    } else {
      const img = new Image();
      img.decoding = "async";
      img.onload = markReady;
      img.src = resolvePath(path);
      item.el = img;
    }

    pool.push(item);
    if (pool.length > PRELOAD_POOL * 2) pool.shift();
  }

  function pumpPreload() {
    if (paused || !manifest.length) return;
    const pending = pool.filter((item) => !item.ready).length;
    const want = PRELOAD_POOL - pool.length + pending;
    for (let i = 0; i < want; i++) preloadOne();
  }

  function stopTimers() {
    stopPreload();
    stopAutoSpawn();
  }

  function stopPreload() {
    if (preloadTimer) {
      clearInterval(preloadTimer);
      preloadTimer = null;
    }
  }

  function beginPreload() {
    if (preloadTimer) return;
    pumpPreload();
    preloadTimer = setInterval(pumpPreload, 200);
  }

  function activate() {
    if (paused || document.body.classList.contains("white-bg")) return;
    beginPreload();
    tryInitialSpawn();
  }

  function dismiss() {
    const had = visible.length > 0;
    visible.forEach((el) => el.remove());
    visible = [];
    stopTimers();
    started = false;
    initialSpawned = false;
    return had;
  }

  function pause() {
    paused = true;
    stopTimers();
    started = false;
    initialSpawned = false;
  }

  function restart() {
    dismiss();
    paused = false;
    pool = [];
    activate();
  }

  function hasVisible() {
    return visible.length > 0;
  }

  async function init() {
    if (!document.getElementById("aleph-stage")) return;

    try {
      const res = await fetch(resolvePath("project-images.json"));
      manifest = await res.json();
    } catch (err) {
      console.warn("project-float: manifest load failed", err);
      return;
    }

    manifest = manifest.filter(isProjectAsset);
    if (!manifest.length) return;

    if (document.body.classList.contains("white-bg")) {
      paused = true;
    } else {
      activate();
    }

    window.ProjectFloat = {
      dismiss,
      hasVisible,
      pause,
      resume: restart,
      restart,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
