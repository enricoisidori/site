import { createMP4Muxer } from './mp4-muxer.js';

// Full recording: R starts, R again stops and downloads one MP4 with
// everything played in between (every video, in order, with its sound; time
// spent in pause is left out). The picture is the largest area of the chosen
// format (3:4 by default, or 16:9) centred on the screen; subtitles and panels
// are not recorded. Nothing (encoder, audio graph, timers) exists until R.
const FORMATS = { '3:4': { width: 1080, height: 1440 }, '16:9': { width: 1920, height: 1080 } };
const formatKey = 'afterimage:recording-format:v1';
let format = '3:4';
try { const stored = localStorage.getItem(formatKey); if (FORMATS[stored]) format = stored; } catch {}
export const recordingFormats = Object.keys(FORMATS);
export const recordingFormat = () => format;
export function setRecordingFormat(value) {
  if (!FORMATS[value]) return;
  format = value;
  try { localStorage.setItem(formatKey, value); } catch {}
}

export function createRecorder({ name, getScene }) {
  let phase = 'idle', clip = null, clips = [], pending = [], timer = null, hudTimer = null, started = 0, serial = 0, sessionId = 0;
  let surface, context, videoConfig, audioConfig, audioContext, dimensions = FORMATS[format], notice = '', stopPromise = null;
  const playbackTaps = new WeakMap();

  // The recorded area: the largest rectangle of the format centred on the screen.
  function frameRectangle() {
    const aspect = dimensions.width / dimensions.height, h = Math.min(innerHeight, innerWidth / aspect), w = h * aspect;
    return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, width: w, height: h };
  }
  // While recording, a thin line shows the recorded area (it is not recorded).
  const outline = document.createElement('div'); outline.hidden = true;
  outline.style.cssText = 'position:fixed;z-index:2;pointer-events:none;box-sizing:border-box;border:1px solid white;outline:1px solid #0008';
  document.body.append(outline);
  function updateFrame() {
    const r = frameRectangle(); outline.hidden = phase !== 'recording';
    Object.assign(outline.style, { left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  addEventListener('resize', updateFrame);
  const hud = document.createElement('div'); hud.hidden = true; hud.setAttribute('role', 'status');
  hud.style.cssText = 'position:fixed;z-index:2147483647;top:10px;left:50%;transform:translateX(-50%);pointer-events:none;font:12px/1.4 Helvetica,Arial,sans-serif;color:white;text-shadow:0 1px 3px black;white-space:nowrap';
  const dot = document.createElement('span'); dot.textContent = '● '; dot.style.color = '#f22';
  const feedback = document.createElement('span'); hud.append(dot, feedback); document.body.append(hud);
  function status() {
    const seconds = Math.floor((performance.now() - started) / 1000), clock = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    hud.hidden = false; dot.hidden = phase !== 'recording';
    feedback.textContent = phase === 'recording' ? `rec ${clock} · ${format}${!audioConfig ? ' · no sound' : clip?.audioUnavailable ? ' · source sound unavailable' : ''} · r to save` : notice;
  }
  function message(text) { notice = text; status(); }
  function hideLater() { setTimeout(() => { if (phase === 'idle') hud.hidden = true; }, 5000); }
  function error(reason) { message('recording: ' + (reason?.message || reason)); if (phase === 'recording') void stop(); }

  // While capturing, the media element supplies the full source sound; its
  // separate playback gain follows the page's mute state, so nothing leaks.
  function syncAudioMonitor() {
    const c = clip, scene = getScene(); if (!c?.tap || c.ended || scene?.key !== c.key) return;
    c.monitorMuted = Boolean(scene.muted); c.tap.gain.gain.value = c.monitorMuted ? 0 : c.monitorVolume;
    c.element.muted = false; c.element.volume = 1;
  }
  function prepareAudioMonitor(scene, c) {
    const video = scene.video; c.element = video; c.monitorVolume = video.volume; c.monitorMuted = Boolean(scene.muted);
    let tap = playbackTaps.get(video);
    if (!tap) { const node = audioContext.createMediaElementSource(video), gain = audioContext.createGain(); tap = { node, gain, connected: false }; playbackTaps.set(video, tap); }
    tap.gain.gain.value = c.monitorMuted ? 0 : c.monitorVolume;
    if (!tap.connected) { tap.node.connect(tap.gain); tap.gain.connect(audioContext.destination); tap.connected = true; }
    c.tap = tap; syncAudioMonitor();
  }
  function releaseMedia(video) { const tap = playbackTaps.get(video); if (tap) { tap.node.disconnect(); tap.gain.disconnect(); tap.connected = false; } }
  function disconnectInput(c = clip) {
    if (!c) return;
    if (c.tap) { c.element.muted = c.monitorMuted; c.element.volume = c.monitorVolume; c.tap.gain.gain.value = 1; c.tap = null; }
    c.reader?.cancel().catch(() => {}); c.reader = null; c.stream?.getTracks().forEach(t => t.stop()); c.stream = null;
  }
  function encodeAudio(c, planar, frames) {
    if (c.ae?.state !== 'configured') return;
    const data = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: frames, numberOfChannels: 2, timestamp: Math.round(c.audioFrames / 48000 * 1e6), data: planar });
    try { c.ae.encode(data); c.audioFrames += frames; } finally { data.close(); }
  }
  function connectInput(scene, c) {
    if (!audioConfig) return;
    const get = scene.video?.captureStream || scene.video?.mozCaptureStream;
    if (!get) { c.audioUnavailable = true; return; }
    try {
      prepareAudioMonitor(scene, c);
      c.stream = get.call(scene.video); const track = c.stream.getAudioTracks()[0];
      if (!track) { c.audioUnavailable = true; return; }
      c.stream.getVideoTracks().forEach(t => t.stop()); c.reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
      const reader = c.reader;
      (async () => {
        while (!c.ended) {
          const { value, done } = await reader.read(); if (done) break;
          try {
            if (c.ended) break; if (c.pauseStarted) continue; c.audioRunning = true;
            const frames = Math.max(1, Math.round(value.numberOfFrames * 48000 / value.sampleRate)), planar = new Float32Array(frames * 2);
            // The source track, independently of the page's mute and volume.
            for (let ch = 0; ch < 2; ch++) {
              const input = new Float32Array(value.numberOfFrames); value.copyTo(input, { planeIndex: Math.min(ch, value.numberOfChannels - 1), format: 'f32-planar' });
              for (let i = 0; i < frames; i++) { const at = i * value.sampleRate / 48000, low = Math.min(input.length - 1, Math.floor(at)), high = Math.min(input.length - 1, low + 1); planar[ch * frames + i] = input[low] + (input[high] - input[low]) * (at - low); }
            }
            encodeAudio(c, planar, frames);
          } finally { value.close(); }
        }
      })().catch(() => { if (!c.ended) { c.audioRunning = false; c.audioUnavailable = true; } });
    } catch { c.audioUnavailable = true; }
  }
  // One clip per video on screen; the clips are joined in order at the end.
  function begin(scene) {
    const c = { session: sessionId, key: scene.key, order: serial++, started: performance.now(), ended: false, video: [], audio: [], audioFrames: 0, last: 0, frameCount: 0 }; clip = c;
    c.ve = new VideoEncoder({ output: (chunk, meta) => c.video.push({ chunk, meta }), error }); c.ve.configure(videoConfig);
    if (audioConfig) { c.ae = new AudioEncoder({ output: (chunk, meta) => c.audio.push({ chunk, meta }), error }); c.ae.configure(audioConfig); }
    connectInput(scene, c); return c;
  }
  function finish(c) {
    if (!c || c.ended) return; c.ended = true; disconnectInput(c);
    c.duration = Math.max(c.last + 40000, Math.ceil(((c.pauseStarted || performance.now()) - c.started) * 1000 / 20000) * 20000);
    const job = (async () => {
      try {
        await c.ve.flush();
        const keep = c.session === sessionId;
        // The last picture holds until the clip's end, and silence fills the sound.
        if (keep && c.preview) { for (const timestamp of [c.duration - 40000, c.duration - 20000]) if (timestamp > c.last) { const frame = new VideoFrame(c.preview, { timestamp, duration: 20000 }); c.ve.encode(frame, { keyFrame: true }); frame.close(); c.last = timestamp; } await c.ve.flush(); }
        if (keep && c.ae) while (c.audioFrames / 48000 * 1e6 < c.duration) { const frames = Math.min(1024, Math.ceil((c.duration / 1e6 - c.audioFrames / 48000) * 48000)); if (frames <= 0) break; encodeAudio(c, new Float32Array(frames * 2), frames); }
        await c.ae?.flush();
        if (keep && c.video.length) clips.push(c); else { c.video.length = 0; c.audio.length = 0; }
      } finally { c.preview?.close(); c.preview = null; if (c.ve.state !== 'closed') c.ve.close(); if (c.ae && c.ae.state !== 'closed') c.ae.close(); }
    })(); pending.push(job); job.catch(error);
  }
  function sample() {
    if (phase !== 'recording') return;
    try {
      const scene = getScene();
      if (!scene) { if (clip) { finish(clip); clip = null; } return; }
      if (!clip || clip.key !== scene.key) { finish(clip); begin(scene); }
      const c = clip; if (c.ended) return; syncAudioMonitor();
      if (scene.paused) { c.pauseStarted ??= performance.now(); return; }
      if (c.pauseStarted) { c.started += performance.now() - c.pauseStarted; c.pauseStarted = null; c.forceKeyFrame = true; }
      if (c.ae && !c.audioRunning) { const gap = Math.floor((performance.now() - c.started) * 48) - c.audioFrames; if (gap >= 1024) encodeAudio(c, new Float32Array(2048), 1024); }
      if (c.ve.encodeQueueSize > 48) return;
      if (c.ve.encodeQueueSize > 12 && !c.draining) { c.draining = true; c.ve.flush().then(() => { c.draining = false; }).catch(error); c.forceKeyFrame = true; }
      const timestamp = c.frameCount ? Math.round((performance.now() - c.started) * 1000) : 0;
      if (c.frameCount && timestamp - c.last < 35000) return;
      const area = frameRectangle(); context.save();
      try { context.fillStyle = '#000'; context.fillRect(0, 0, surface.width, surface.height); context.scale(surface.width / area.width, surface.height / area.height); context.translate(-area.x, -area.y); scene.draw(context, innerWidth, innerHeight); } finally { context.restore(); }
      const frame = new VideoFrame(surface, { timestamp, duration: 40000 });
      try { c.ve.encode(frame, { keyFrame: c.forceKeyFrame || c.frameCount % 25 === 0 }); c.preview?.close(); c.preview = frame.clone(); c.forceKeyFrame = false; c.last = timestamp; c.frameCount++; } finally { frame.close(); }
    } catch (e) { error(e); }
  }
  async function start() {
    if (phase !== 'idle') return; const token = ++sessionId; phase = 'starting'; dimensions = FORMATS[format]; message('starting the recording…');
    try {
      if (!globalThis.VideoEncoder || !globalThis.VideoFrame) throw Error('MP4 recording is not supported by this browser: use an up-to-date Chrome or Edge');
      const { width, height } = dimensions, blocks = Math.ceil(width / 16) * Math.ceil(height / 16), level = blocks <= 3600 ? '1f' : blocks <= 8192 ? '28' : blocks <= 8704 ? '2a' : blocks <= 22080 ? '32' : blocks <= 36864 ? '33' : '3c';
      videoConfig = { codec: 'avc1.4200' + level, width, height, bitrate: Math.min(18000000, Math.round(3000000 * width * height / (1280 * 720))), framerate: 25, latencyMode: 'realtime', avc: { format: 'avc' } };
      if (!(await VideoEncoder.isConfigSupported(videoConfig)).supported) throw Error('H.264 MP4 encoder unavailable'); if (token !== sessionId) return;
      audioConfig = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 };
      if (!globalThis.AudioEncoder || !globalThis.MediaStreamTrackProcessor || !(await AudioEncoder.isConfigSupported(audioConfig)).supported) throw Error('MP4 recording with sound is not supported: use an up-to-date Chrome or Edge'); if (token !== sessionId) return;
      audioContext ??= new AudioContext(); await audioContext.resume(); if (token !== sessionId) return;
      surface = document.createElement('canvas'); surface.width = width; surface.height = height; context = surface.getContext('2d', { alpha: false });
      clips = []; pending = []; clip = null; serial = 0; started = performance.now(); phase = 'recording'; updateFrame(); sample();
      timer = setInterval(sample, 40); hudTimer = setInterval(status, 200); status();
    } catch (e) { if (token !== sessionId) return; phase = 'idle'; await cleanup(); message(e.message); hideLater(); }
  }
  async function cleanup() {
    clearInterval(timer); clearInterval(hudTimer); timer = hudTimer = null; disconnectInput();
    if (surface) { surface.width = surface.height = 0; surface = context = null; }
  }
  async function stop() {
    if (stopPromise) return stopPromise; if (phase !== 'recording') return; const token = sessionId;
    sample(); phase = 'saving'; updateFrame(); finish(clip); clip = null; clearInterval(timer); clearInterval(hudTimer); message('putting the MP4 together…');
    stopPromise = (async () => {
      try {
        await Promise.all(pending); if (token !== sessionId) return; await cleanup();
        const ordered = clips.sort((a, b) => a.order - b.order); if (!ordered.length) { message('nothing was recorded'); return; }
        const { Muxer, ArrayBufferTarget } = createMP4Muxer(), target = new ArrayBufferTarget();
        const muxer = new Muxer({ target, video: { codec: 'avc', width: videoConfig.width, height: videoConfig.height }, ...(audioConfig ? { audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } } : {}), fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
        let offset = 0;
        for (const c of ordered) {
          const first = c.video[0].chunk.timestamp;
          for (let i = 0; i < c.video.length; i++) {
            const { chunk, meta } = c.video[i], at = chunk.timestamp - first, until = i + 1 < c.video.length ? c.video[i + 1].chunk.timestamp - first : c.duration;
            const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); muxer.addVideoChunkRaw(bytes, chunk.type, offset + at, Math.max(1, until - at), meta);
          }
          if (audioConfig) for (const { chunk, meta } of c.audio) { const at = Math.max(0, chunk.timestamp); if (at >= c.duration) continue; const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); muxer.addAudioChunkRaw(bytes, chunk.type, offset + at, Math.min(chunk.duration, c.duration - at), meta); }
          offset += c.duration;
        }
        muxer.finalize();
        const url = URL.createObjectURL(new Blob([target.buffer], { type: 'video/mp4' })), a = document.createElement('a');
        a.href = url; a.download = name + '_' + format.replace(':', 'x') + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.mp4'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
        message(`MP4 saved · ${ordered.length} videos · ${Math.round(offset / 1e6)} s`);
      } catch (e) { if (token === sessionId) message('recording error: ' + e.message); }
      finally { if (token === sessionId) { await cleanup(); clips = []; pending = []; phase = 'idle'; stopPromise = null; hideLater(); } }
    })(); return stopPromise;
  }
  document.addEventListener('keydown', event => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input:not([type="checkbox"]),textarea,select,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() !== 'r') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (phase === 'idle') void start(); else if (phase === 'recording') void stop();
  }, true);
  return {
    start, stop, sample, syncAudioMonitor, releaseMedia,
    get status() { return { phase, format, width: dimensions.width, height: dimensions.height, frame: frameRectangle(), frames: clip?.frameCount || 0, audioFrames: clip?.audioFrames || 0, queued: clip?.ve?.encodeQueueSize || 0, clips: clips.length, notice }; },
  };
}
