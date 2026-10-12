const overlay = document.querySelector('#loading');
const canvas = document.querySelector('#noise');
const context = canvas.getContext('2d', { alpha: true });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pixels, words, luma, mode = 'hidden', frame = 0, lastDraw = 0, revealAt = 0;
let seed = (Math.random() * 0xffffffff) >>> 0 || 123456789;
function resize() {
  canvas.width = Math.min(960, Math.max(320, innerWidth));
  canvas.height = Math.max(180, Math.round(canvas.width * innerHeight / innerWidth));
  pixels = context.createImageData(canvas.width, canvas.height);
  words = new Uint32Array(pixels.data.buffer);
  luma = new Uint8Array(words.length);
}
function noise() {
  for (let i = 0; i < words.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const value = seed & 255;
    luma[i] = value; words[i] = (255 << 24) | value * 0x010101;
  }
  context.putImageData(pixels, 0, 0);
}
function key(progress) {
  // The frozen noise luminance is the matte: dark pixels key out first.
  // Only alpha changes; the playing video underneath is never read into canvas.
  // Smoothstep keeps the luma-key transition gradual at its ends.
  const eased = progress * progress * (3 - 2 * progress);
  const threshold = -24 + eased * 304;
  for (let i = 0; i < words.length; i++) {
    const value = luma[i];
    const alpha = Math.max(0, Math.min(255, (value - threshold) * 10 + 128));
    words[i] = (alpha << 24) | value * 0x010101;
  }
  context.putImageData(pixels, 0, 0);
}
function animate(now) {
  frame = 0;
  if (mode === 'waiting') {
    if (now - lastDraw >= 1000 / 30) { noise(); lastDraw = now; }
  } else if (mode === 'reveal') {
    const progress = Math.min(1, (now - revealAt) / 2600);
    key(progress);
    if (progress === 1) { mode = 'hidden'; overlay.hidden = true; return; }
  } else return;
  frame = requestAnimationFrame(animate);
}
export function setWaiting(value) {
  if (value && mode === 'waiting' || !value && mode !== 'waiting') return;
  if (frame) cancelAnimationFrame(frame);
  if (value) {
    mode = 'waiting'; overlay.hidden = false;
    overlay.classList.remove('revealed'); overlay.setAttribute('aria-hidden', 'false');
    noise(); lastDraw = performance.now();
    if (!reduced) frame = requestAnimationFrame(animate);
  } else {
    overlay.classList.add('revealed'); overlay.setAttribute('aria-hidden', 'true');
    if (reduced) { mode = 'hidden'; overlay.hidden = true; }
    else { mode = 'reveal'; revealAt = performance.now(); frame = requestAnimationFrame(animate); }
  }
}
resize();
addEventListener('resize', () => { resize(); if (mode === 'waiting') noise(); });
setWaiting(true);
