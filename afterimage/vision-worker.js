// All inference is on the device. No frame is uploaded to a model API.
// A zero-shot tagger, not a captioner: only the MobileCLIP-S0 image encoder runs
// here. The text side was computed offline (tools/build-afterimage-vocabulary.mjs)
// into vision/embeddings.bin, one int8 row per tag. Tags are ranked by how far a
// frame's similarity sits above that tag's usual similarity on real Archive
// frames (z-score), among the tags the frame matches best in absolute terms.
const MODEL = 'Xenova/mobileclip_s0';
const REVISION = '757d59c9c6870a76a4b0306f05f5061bca15c39f';
// fp16 (22.9 MB) ranks like fp32. The int8/uint8/q8 exports of this vision model
// are broken (embeddings unrelated to fp32), so they must not be used.
const DTYPE = 'fp16';
let processor, model, RawImage, vocab, rows;
let loading;
const progress = data => self.postMessage({ type: 'progress', file: data.file, progress: data.progress, status: data.status });
async function fetchVision(name) {
  const response = await fetch(new URL(`./vision/${name}`, import.meta.url));
  if (!response.ok) throw new Error(`vision/${name}: HTTP ${response.status}`);
  return response;
}
async function warmup() {
  if (!loading) loading = (async () => {
    const lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
    RawImage = lib.RawImage;
    lib.env.allowLocalModels = false;
    lib.env.backends.onnx.wasm.numThreads = 1;
    lib.env.backends.onnx.wasm.proxy = false;
    const tables = (async () => {
      progress({ file: 'vision/embeddings.bin', progress: 0, status: 'progress' });
      const [json, bin] = await Promise.all([fetchVision('vocabulary.json').then(r => r.json()), fetchVision('embeddings.bin').then(r => r.arrayBuffer())]);
      if (bin.byteLength !== json.tags.length * json.dim) throw new Error('vision/embeddings.bin does not match vocabulary.json');
      vocab = json; rows = new Int8Array(bin);
      progress({ file: 'vision/embeddings.bin', progress: 100, status: 'done' });
    })();
    [processor, model] = await Promise.all([
      lib.AutoProcessor.from_pretrained(MODEL, { revision: REVISION }),
      lib.CLIPVisionModelWithProjection.from_pretrained(MODEL, { revision: REVISION, dtype: DTYPE, device: 'wasm', progress_callback: progress }),
    ]);
    await tables;
  })().catch(error => { loading = null; throw error; });
  return loading;
}
// Places end the caption ("… in a television studio"); everything else is a subject.
const PLACE = /\b(room|chamber|hall|street|studio|stage|office|church|kitchen|field|beach|forest|park|lobby|classroom|restaurant|bar|garden|road|highway|city|town|village|desert|mountain|lake|river|ocean|sea|sky|stadium|arena|court|track|gym|library|museum|hospital|airport|station|market|shop|store|warehouse|factory|farm|barn|bedroom|bathroom|courtroom|theater|theatre|cinema|temple|mosque|cathedral|square|plaza|alley|harbor|port|bridge|tunnel|cave|island|landscape|interior|lobby|parking lot)$/;
const article = tag => (/^[aeiou]/.test(tag) ? 'an ' : 'a ') + tag;
function similarity(a, b) {
  const { dim, scale } = vocab; let s = 0;
  for (let d = 0, oa = a * dim, ob = b * dim; d < dim; d++) s += rows[oa + d] * rows[ob + d];
  return s * scale[a] * scale[b];
}
// Two tags say the same thing when they share a word or their texts are close.
const overlaps = (a, b) => vocab.tags[a].split(' ').some(word => vocab.tags[b].split(' ').includes(word)) || similarity(a, b) > .8;
// The caption is one sentence: kind of footage, then the most distinctive
// subjects and a place. Its tags, most distinctive first, are the keywords.
function describe(embedding) {
  const { tags, dim, scale, mean, std, candidates, styles } = vocab;
  let norm = 0; for (let d = 0; d < dim; d++) norm += embedding[d] * embedding[d];
  norm = Math.sqrt(norm) || 1;
  const sims = new Float32Array(tags.length);
  for (let t = 0, o = 0; t < tags.length; t++, o += dim) {
    let s = 0; for (let d = 0; d < dim; d++) s += embedding[d] * rows[o + d];
    sims[t] = s * scale[t] / norm;
  }
  // Absolute similarity picks plausible candidates; the prior-corrected score
  // (how unusual this tag is for an Archive frame) orders them.
  const z = t => (sims[t] - mean[t]) / std[t];
  const pool = [...sims.keys()].sort((a, b) => sims[b] - sims[a]).slice(0, candidates).sort((a, b) => z(b) - z(a));
  const subjects = [], place = pool.find(t => PLACE.test(tags[t]));
  for (const t of pool) {
    if (subjects.length === 3) break;
    if (t !== place && !PLACE.test(tags[t]) && ![...subjects, place].some(o => o != null && overlaps(t, o))) subjects.push(t);
  }
  let style = '';
  if (styles?.length) {
    let best = -Infinity;
    for (const { caption, vector } of styles) { let s = 0; for (let d = 0; d < dim; d++) s += embedding[d] * vector[d]; if (s > best) { best = s; style = caption; } }
  }
  const [subject, detail, extra] = subjects.map(t => tags[t]);
  const where = place == null ? '' : subject ? `in ${article(tags[place])}` : article(tags[place]);
  const caption = [style || 'frame of', subject && article(subject), detail && `with ${article(detail)}`, extra && `and ${article(extra)}`, where].filter(Boolean).join(' ');
  const terms = [...subjects, ...(place != null ? [place] : [])].sort((a, b) => z(b) - z(a)).map(t => tags[t]);
  return { caption, terms };
}
async function handle(data) {
  try {
    await warmup();
    if (data.type === 'warmup') { self.postMessage({ id: data.id, ready: true }); return; }
    const started = performance.now();
    const image = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4);
    const { image_embeds } = await model(await processor(image));
    const { caption, terms } = describe((image_embeds.type === 'float32' ? image_embeds : image_embeds.to('float32')).data);
    self.postMessage({ id: data.id, caption, terms, inferenceMs: performance.now() - started });
  } catch (error) { self.postMessage({ id: data.id, error: error.message || String(error) }); }
}

let jobs = Promise.resolve();
self.onmessage = ({ data }) => { jobs = jobs.then(() => handle(data)); };
