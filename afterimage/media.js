export const MAX_PLAY_SECONDS = 30;
// iPhone/iPad only. Safari there plays only byte-range media and reads video
// pixels only from the page's own origin; Archive /cors/ URLs ignore Range.
export const ios = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let relay;
export async function playableURL(url) {
  if (!ios) return url;
  // On Cloudflare the same-origin relay streams Archive with Range (exact frames
  // for the model). Elsewhere /download/ still plays; frames then come from
  // Archive's scene thumbnails through captureItemFrame's fallback.
  relay ||= fetch(new URL('/__blueness_media/status', location.href), { cache: 'no-store', signal: AbortSignal.timeout(2500) })
    .then(response => response.ok ? response.json() : null).then(status => status?.service === 'blueness-range-relay').catch(() => false);
  if (await relay) { const target = new URL('/__blueness_media/video', location.href); target.searchParams.set('url', url); return target.href; }
  return url.replace('https://archive.org/cors/', 'https://archive.org/download/');
}
export function bufferAhead(video, time = video.currentTime) {
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= time + .05 && video.buffered.end(i) >= time) return video.buffered.end(i) - time;
  }
  return 0;
}
export function hasBuffer(video, start, seconds) {
  return bufferAhead(video, start) >= Math.min(seconds, video.duration - start) - .08;
}
export function waitFor(check, signal, timeout = 12000) {
  return new Promise((resolve, reject) => {
    let timer, poll, settled = false;
    const finish = error => {
      if (settled) return; settled = true;
      clearTimeout(timer); clearInterval(poll); signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(signal.reason || new DOMException('aborted', 'AbortError'));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(new Error('video preparation timeout')), timeout);
    poll = setInterval(() => { try { if (check()) finish(); } catch (error) { finish(error); } }, 60);
  });
}
// Archive serves a file in two ways, and no address offers both features:
//   /cors/      readable pixels, but no byte ranges: reaching a point far into
//               the file means downloading everything before it;
//   /download/  byte ranges (any point starts at once), but unreadable pixels.
// `pixels: false` plays through /download/; the frame for the model then comes
// from Archive's own scene thumbnails (see sceneFrame).
export async function prepare(video, url, signal, { startup = false, middle = false, startAt = null, pixels = true, maxStart = Infinity } = {}) {
  try {
    video.muted = true; video.loop = false;
    if (ios) url = await playableURL(url);
    else if (!pixels) url = url.replace('https://archive.org/cors/', 'https://archive.org/download/');
    // A cross-origin stream without CORS headers must not request them.
    if (url.startsWith('https://archive.org/cors/') || new URL(url, location.href).origin === location.origin) video.crossOrigin = 'anonymous'; else video.removeAttribute('crossorigin');
    video.src = url; video.load();
    // Safari on iPhone does not buffer from preload alone: a muted play() starts it.
    if (ios) video.play().catch(() => {});
    await waitFor(() => { if (video.error) throw new Error(video.error.message); return video.readyState >= 1 && Number.isFinite(video.duration); }, signal, 9000);
    if (!(video.duration > 0)) throw new Error('video without a playable duration');
    // Prelinger starts halfway through to bypass opening titles, including startup.
    const start = startAt != null ? Math.max(0,Math.min(startAt,video.duration-.1)) : middle ? video.duration / 2 : startup ? 0 : Math.random() * Math.max(0, Math.min(maxStart, video.duration - MAX_PLAY_SECONDS - .5));
    if (start > .05) video.currentTime = start;
    const began = performance.now();
    const available = Math.max(0, video.duration - start - .02);
    const target = Math.min(startup ? .75 : ios ? 2 : 3, available);
    await waitFor(() => {
      if (video.error) throw new Error(video.error.message);
      const buffered = bufferAhead(video, start);
      return !video.seeking && video.readyState >= 3 && (buffered >= target || !startup && performance.now() - began > 5000 && buffered >= 2.5);
    }, signal, 16000);
    if (ios) { video.pause(); if (Math.abs(video.currentTime - start) > .05) video.currentTime = start; }
    return { start, seconds: Math.max(.01, Math.min(MAX_PLAY_SECONDS, video.duration - start - .02)), remote: true, readable: !!video.crossOrigin };
  } catch (error) { video.pause(); video.removeAttribute('src'); video.load(); throw error; }
}
export async function startPlaying(video, signal) {
  await new Promise((resolve, reject) => {
    let settled = false;
    const done = error => {
      if (settled) return; settled = true; clearTimeout(timer);
      signal?.removeEventListener('abort', abort); error ? reject(error) : resolve();
    };
    const abort = () => done(signal.reason || new DOMException('aborted', 'AbortError'));
    const timer = setTimeout(() => done(new Error('video start timeout')), 4000);
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    video.play().then(() => done(), done);
  });
  if ('requestVideoFrameCallback' in video) await new Promise(resolve => {
    const callback = video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); });
    const timer = setTimeout(() => { video.cancelVideoFrameCallback(callback); resolve(); }, 160);
  });
}
export function release(slot) {
  slot.video.style.transform = ''; slot.bars = null; slot.crop = 1;
  slot.video.pause(); slot.video.classList.remove('on'); slot.video.removeAttribute('src'); slot.video.load();
  slot.media = null; slot.item = null; slot.role = 'idle'; slot.kind = null;
}
export function capture(video) {
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 384 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
  canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  return { pixels: frame.data.buffer, width: canvas.width, height: canvas.height, preview: canvas.toDataURL('image/jpeg', .65), time: video.currentTime, bars: barsOf(context, canvas.width, canvas.height) };
}

const stemsOf = item => [item.original, item.filename].filter(Boolean).map(name => name.replace(/\.[^.]+$/, '').replace(/(?:_512kb|_h264|_3mb|\.ia)$/i, '').toLowerCase());
// Scene thumbnails Archive extracted from this very file, in time order.
export function scenesOf(item) {
  const stems = stemsOf(item);
  return (item.frames || []).filter(frame => stems.includes(frame.stem.toLowerCase())).sort((a, b) => a.time - b.time);
}
export function nearestScene(item, time) {
  return scenesOf(item).sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0];
}
// The scene a video will start from. The model describes that thumbnail, so
// the description can be ready before the video itself has buffered.
export function pickScene(item, { startup = false, middle = false } = {}) {
  const duration = item.duration || 0;
  let scenes = scenesOf(item).filter(frame => !duration || frame.time < duration - 2);
  if (!scenes.length) return null;
  if (middle) return scenes.sort((a, b) => Math.abs(a.time - duration / 2) - Math.abs(b.time - duration / 2))[0];
  // Leave room for a full-length play when the file allows it.
  const roomy = scenes.filter(frame => frame.time <= duration - MAX_PLAY_SECONDS);
  if (roomy.length) scenes = roomy; else if (duration) scenes = [scenes[0]];
  // The very first second is usually black or a title card.
  if (scenes.length > 1 && scenes[0].time <= 1) scenes = scenes.slice(1);
  return startup ? scenes[0] : scenes[Math.floor(Math.random() * scenes.length)];
}
// Black bars baked into the picture (a 4:3 file carrying a 16:9 film, or the
// reverse), as fractions of the width and height on each side.
export function barsOf(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const dark = (x0, y0, x1, y1) => { let sum = 0, max = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * width + x) * 4, l = (data[i] + data[i + 1] + data[i + 2]) / 3; sum += l; max = Math.max(max, l); n++; } return n && sum / n < 22 && max < 64; };
  let left = 0, top = 0;
  while (left < width * .3 && dark(left, 0, left + 1, height) && dark(width - 1 - left, 0, width - left, height)) left++;
  while (top < height * .3 && dark(0, top, width, top + 1) && dark(0, height - 1 - top, width, height - top)) top++;
  // A completely dark frame says nothing about bars.
  return left >= width * .3 || top >= height * .3 ? { x: 0, y: 0 } : { x: left / width, y: top / height };
}
async function drawFrame(source, width, height, time, label) {
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 384 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer, width: canvas.width, height: canvas.height, preview: canvas.toDataURL('image/jpeg', .65), time, source: label, bars: barsOf(ctx, canvas.width, canvas.height) };
}
export async function sceneFrame(item, scene, signal) {
  const path = scene.name.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`https://archive.org/cors/${encodeURIComponent(item.id)}/${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
  if (!response.ok) throw new Error(`Fotogramma Archive HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  try { return await drawFrame(bitmap, bitmap.width, bitmap.height, scene.time, 'scena Archive da cui parte il video'); } finally { bitmap.close(); }
}
export async function captureItemFrame(slot, signal) {
  try { return { ...capture(slot.video), source: 'fotogramma del lettore' }; }
  catch (error) {
    if (error.name !== 'SecurityError') throw error;
    const frame = nearestScene(slot.item, slot.video.currentTime);
    if (!frame) throw new Error('this file has no Archive scene frames');
    return { ...await sceneFrame(slot.item, frame, signal), source: 'scena Archive più vicina (tempo approssimato)' };
  }
}
