/* Luma key dinamico sulle thumbnails: a velocità di scroll = 0
   le immagini sono pure; quando scrolli, i pixel chiari si dissolvono
   verso il canvas Wikipedia di sfondo, proporzionalmente alla velocità. */
(function () {
  const SCROLL_FEATHER = 0.18;
  const VELOCITY_FULL = 2.5; // px/ms per raggiungere threshold massimo
  const DECAY = 0.9;
  const EPSILON = 0.005;

  const thumbs = [];

  function setupThumb(img) {
    const wrap = document.createElement("span");
    wrap.className = "thumb-wrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    const canvas = document.createElement("canvas");
    canvas.className = "thumb-luma-overlay";
    wrap.appendChild(canvas);

    const obj = {
      img,
      canvas,
      wrap,
      ctx: null,
      pixA: null,
      w: 0,
      h: 0,
      ready: false,
      visible: true,
      lastDrawnThreshold: -1,
    };
    thumbs.push(obj);

    function paintInitial() {
      const nw = img.naturalWidth || 320;
      const nh = img.naturalHeight || 213;
      const w = Math.min(nw, 320);
      const h = Math.round((nh * w) / nw);
      canvas.width = w;
      canvas.height = h;
      obj.w = w;
      obj.h = h;
      obj.ctx = canvas.getContext("2d", { willReadFrequently: true });
      obj.ctx.drawImage(img, 0, 0, w, h);
      try {
        obj.pixA = obj.ctx.getImageData(0, 0, w, h);
        obj.ready = true;
      } catch (e) {
        // CORS-tainted canvas: skip luma effect for this thumb
        obj.ready = false;
      }
    }

    if (img.complete && img.naturalWidth > 0) paintInitial();
    else img.addEventListener("load", paintInitial, { once: true });
  }

  function init() {
    document.querySelectorAll("img.thumb").forEach(setupThumb);

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const obj = thumbs.find((t) => t.wrap === entry.target);
            if (obj) obj.visible = entry.isIntersecting;
          }
        },
        { rootMargin: "200px" }
      );
      thumbs.forEach((t) => io.observe(t.wrap));
    }
  }

  let lastY = 0;
  let lastT = performance.now();
  let velocityNorm = 0;

  function onScroll() {
    const scrollEl = document.getElementById("content-scroll");
    if (!scrollEl) return;
    const now = performance.now();
    const y = scrollEl.scrollTop;
    const dy = Math.abs(y - lastY);
    const dt = Math.max(1, now - lastT);
    const inst = dy / dt;
    const norm = Math.min(inst / VELOCITY_FULL, 1);
    if (norm > velocityNorm) velocityNorm = norm;
    lastY = y;
    lastT = now;
  }

  function renderLuma(obj, threshold) {
    if (!obj.ready) return;
    if (Math.abs(threshold - obj.lastDrawnThreshold) < 0.01) return;
    obj.lastDrawnThreshold = threshold;

    if (threshold <= 0) {
      obj.canvas.style.opacity = "0";
      return;
    }

    obj.canvas.style.opacity = "1";
    const A = obj.pixA.data;
    const out = obj.ctx.createImageData(obj.w, obj.h);
    const d = out.data;

    for (let i = 0; i < A.length; i += 4) {
      const luma = (0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]) / 255;
      // alpha: pixel chiari si dissolvono prima
      let alpha = 1 - ((threshold - luma) / SCROLL_FEATHER + 0.5);
      if (alpha < 0) alpha = 0;
      if (alpha > 1) alpha = 1;
      d[i] = A[i];
      d[i + 1] = A[i + 1];
      d[i + 2] = A[i + 2];
      d[i + 3] = alpha * 255;
    }
    obj.ctx.putImageData(out, 0, 0);
  }

  function tick() {
    velocityNorm *= DECAY;
    if (velocityNorm < EPSILON) velocityNorm = 0;

    for (const t of thumbs) {
      if (!t.visible) continue;
      renderLuma(t, velocityNorm);
    }

    requestAnimationFrame(tick);
  }

  function start() {
    init();
    const scrollEl = document.getElementById("content-scroll");
    if (scrollEl) {
      scrollEl.addEventListener("scroll", onScroll, { passive: true });
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
