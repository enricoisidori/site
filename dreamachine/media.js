export const MAX_PLAY_SECONDS = 30;
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
    timer = setTimeout(() => finish(new Error('timeout preparazione video')), timeout);
    poll = setInterval(() => { try { if (check()) finish(); } catch (error) { finish(error); } }, 60);
  });
}
export async function prepare(video, url, signal, { startup = false, middle = false } = {}) {
  try {
    video.muted = true; video.loop = false; video.src = url; video.load();
    await waitFor(() => { if (video.error) throw new Error(video.error.message); return video.readyState >= 1 && Number.isFinite(video.duration); }, signal, 9000);
    if (!(video.duration > 0)) throw new Error('video senza durata riproducibile');
    // Prelinger starts halfway through to bypass opening titles, including startup.
    const start = middle ? video.duration / 2 : startup ? 0 : Math.random() * Math.max(0, video.duration - MAX_PLAY_SECONDS - .5);
    if (start > .05) video.currentTime = start;
    const began = performance.now();
    const available = Math.max(0, video.duration - start - .02);
    const target = Math.min(startup ? 1.5 : 8, available);
    await waitFor(() => {
      if (video.error) throw new Error(video.error.message);
      const buffered = bufferAhead(video, start);
      return !video.seeking && video.readyState >= 3 && (buffered >= target || !startup && performance.now() - began > 8000 && buffered >= 6);
    }, signal, 16000);
    return { start, seconds: Math.max(.01, Math.min(MAX_PLAY_SECONDS, video.duration - start - .02)), remote: true };
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
    const timer = setTimeout(() => done(new Error('timeout avvio video')), 4000);
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
  return { pixels: frame.data.buffer, width: canvas.width, height: canvas.height, preview: canvas.toDataURL('image/jpeg', .65), time: video.currentTime };
}

export function nearestScene(item, time) {
  const stems = [item.original, item.filename].filter(Boolean).map(name => name.replace(/\.[^.]+$/, '').replace(/_(?:512kb|h264|3mb)$/i, '').toLowerCase());
  return (item.frames || []).filter(frame => stems.includes(frame.stem.toLowerCase()))
    .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0];
}
export async function captureItemFrame(slot, signal) {
  try { return { ...capture(slot.video), source: 'fotogramma del lettore' }; }
  catch (error) {
    if (error.name !== 'SecurityError') throw error;
    const frame = nearestScene(slot.item, slot.video.currentTime);
    if (!frame) throw new Error('Questo file non ha frame di scena Archive: uso il fallback casuale');
    const path = frame.name.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`https://archive.org/cors/${encodeURIComponent(slot.item.id)}/${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
    if (!response.ok) throw new Error(`Fotogramma Archive HTTP ${response.status}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    return { pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer, width: canvas.width, height: canvas.height, preview: canvas.toDataURL('image/jpeg', .65), time: frame.time, source: 'scena Archive più vicina (tempo approssimato)' };
  }
}
