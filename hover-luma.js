/* Luma key istantaneo on hover sulle thumbnail.
   Mouseenter: l'img originale sparisce, il canvas overlay mostra
   solo i pixel scuri (i pixel chiari diventano trasparenti → si vede
   il canvas Wikipedia di sfondo).
   Mouseleave: ripristino istantaneo, nessuna transizione. */
(function () {
  const THRESHOLD = 0.52;
  const FEATHER = 0.06;

  function buildCanvas(img) {
    const parent = img.closest(".designerpage, .artistpage");
    if (!parent) return null;

    const canvas = document.createElement("canvas");
    canvas.className = "hover-luma-canvas";

    const pw = img.offsetWidth;
    const ph = img.offsetHeight;
    const pt = img.offsetTop;
    const pl = img.offsetLeft;
    canvas.style.top = pt + "px";
    canvas.style.left = pl + "px";
    canvas.style.width = pw + "px";
    canvas.style.height = ph + "px";

    const cw = Math.min(img.naturalWidth || pw, 320);
    const ch = Math.round(((img.naturalHeight || ph) * cw) / (img.naturalWidth || pw));
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    try {
      ctx.drawImage(img, 0, 0, cw, ch);
    } catch (_) {
      return null; // CORS
    }
    const pixA = ctx.getImageData(0, 0, cw, ch);

    // Precomputa l'ImageData con luma key
    const out = ctx.createImageData(cw, ch);
    const A = pixA.data;
    const d = out.data;
    for (let i = 0; i < A.length; i += 4) {
      const luma = (0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]) / 255;
      // Pixel chiari → alpha 0 (trasparenti → mostra Wikipedia)
      // Pixel scuri  → alpha 1 (opachi    → mostra il soggetto)
      let alpha = 1 - ((luma - THRESHOLD) / FEATHER + 0.5);
      if (alpha < 0) alpha = 0;
      if (alpha > 1) alpha = 1;
      d[i] = A[i];
      d[i + 1] = A[i + 1];
      d[i + 2] = A[i + 2];
      d[i + 3] = alpha * 255;
    }
    ctx.putImageData(out, 0, 0);

    parent.appendChild(canvas);
    img._hoverLuma = canvas;
    return canvas;
  }

  function onEnter() {
    const img = this;
    if (!img.complete || !img.naturalWidth) return;
    const canvas = img._hoverLuma || buildCanvas(img);
    if (!canvas) return;
    img.style.opacity = "0";
    canvas.style.opacity = "1";
  }

  function onLeave() {
    const img = this;
    img.style.opacity = "";
    if (img._hoverLuma) img._hoverLuma.style.opacity = "0";
  }

  function setup() {
    document.querySelectorAll("img.thumb").forEach((img) => {
      img.addEventListener("mouseenter", onEnter);
      img.addEventListener("mouseleave", onLeave);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
