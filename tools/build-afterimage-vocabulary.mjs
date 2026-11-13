#!/usr/bin/env node
// Builds the offline half of Afterimage's zero-shot tagger
// (afterimage/vision-worker.js): the text embedding of every tag and
// each tag's usual similarity to real Archive frames.
//
// The browser runs only the MobileCLIP-S0 image encoder. A frame's tags are the
// `candidates` tags with the highest cosine similarity, re-ordered by
// z = (similarity - mean) / std, where mean/std describe how that tag scores on
// ordinary Archive frames. Tags that match almost every frame a little (the
// "hubs" a plain ranking keeps returning) lose their advantage; the absolute
// similarity floor stops tags with a tiny spread from winning on noise.
//
//   node tools/build-afterimage-vocabulary.mjs \
//     --frames <dir of NNNN.jpg Archive frames> \
//     --ram <ram_tags.txt (Recognize Anything tag list)> \
//     --oi <oi.csv (Open Images class names, "id,Name")> \
//     --transformers <path to node_modules/@huggingface/transformers, version 3.8.1> \
//     [--out afterimage/vision] [--cache <dir for the slow text embeddings>]
//
// The transformers path may also be given as AFTERIMAGE_TRANSFORMERS. Models
// download from the Hugging Face Hub at the pinned revision. The text side
// (about 11k tags x 5 prompts) takes ~20 minutes on a laptop CPU; with --cache
// it is computed once. Frames are decoded only as images (sharp, from the
// transformers install), shrunk to at most 384 px like the page's capture.
//
// Output in --out:
//   embeddings.bin   int8, one row of `dim` values per tag (row = round(v / scale))
//   node tools/build-afterimage-vocabulary.mjs --styles-only --transformers <dir>
//     adds only the kinds of footage (STYLES) to an existing vocabulary.json.
//
//   vocabulary.json  { model, revision, dtype, dim, candidates, count, templates,
//                      frames, tags[], scale[], mean[], std[] }
// The image model must stay fp16 or fp32: the published int8/uint8/q8 MobileCLIP-S0
// vision ONNX files give embeddings unrelated to fp32 (cosine ~0.12) and useless tags.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const FRAMES = arg('--frames'), RAM = arg('--ram'), OI = arg('--oi');
const LIB = arg('--transformers', process.env.AFTERIMAGE_TRANSFORMERS);
const OUT = arg('--out', 'afterimage/vision');
const CACHE = arg('--cache');
if (!LIB || !process.argv.includes('--styles-only') && (!FRAMES || !RAM || !OI)) { console.error('usage: see the header of this file'); process.exit(1); }

export const MODEL = 'Xenova/mobileclip_s0';
export const REVISION = '757d59c9c6870a76a4b0306f05f5061bca15c39f';
export const DTYPE = 'fp16'; // what the browser runs; fp16 == fp32 rankings here
export const CANDIDATES = 12, COUNT = 6;
export const TEMPLATES = ['a photo of a {}.', 'a still frame from an old film showing a {}.', 'a blurry low quality video frame of a {}.', 'a black and white photo of a {}.', 'a screenshot of a video with a {}.'];
// Open Images names many car models ("honda element"); they are not visual words.
const CAR_MAKERS = new Set('honda fiat proton ford mercury toyota nissan chevrolet audi kia hyundai mazda suzuki peugeot renault citroen volkswagen lotus dodge chrysler buick cadillac lincoln jaguar opel saab volvo subaru mitsubishi daihatsu tata lada skoda seat alfa holden pontiac plymouth oldsmobile datsun isuzu acura infiniti lexus porsche ferrari lamborghini maserati bentley rover mini smart chevy geo eagle austin morris hillman humber riley sunbeam triumph vauxhall wolseley daewoo ssangyong perodua dacia zastava yugo scion saturn hummer tesla'.split(' '));

export function buildVocabulary(ramText, oiText, dictText) {
  const dict = new Set(dictText.split('\n').filter(w => /^[a-z]+$/.test(w)));
  const ok = s => /^[a-z]+( [a-z]+)?$/.test(s) && s.split(' ').every(w => w.length >= 2);
  const ram = ramText.split('\n').map(s => s.trim().toLowerCase()).filter(ok);
  const ramSet = new Set(ram);
  // Open Images: 1-2 plain words, every word a common lowercase dictionary word, no car models.
  const oi = oiText.split('\n').slice(1).map(l => l.slice(l.indexOf(',') + 1).replace(/^"|"$/g, '').trim())
    .filter(s => /^[A-Za-z]+( [a-z]+)?$/.test(s)).map(s => s.toLowerCase()).filter(ok)
    .filter(s => s.split(' ').every(w => dict.has(w)))
    .filter(s => ramSet.has(s) || !(s.includes(' ') && CAR_MAKERS.has(s.split(' ')[0])));
  return [...new Set([...ram, ...oi])];
}

const lib = await import(pathToFileURL(join(resolve(LIB), 'dist/transformers.node.mjs')).href);
const sharp = createRequire(join(resolve(LIB), 'package.json'))('sharp');
const { AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, RawImage } = lib;

// Kinds of footage. The page names the kind in the caption ("black-and-white
// film still of a …"); these words never become search keywords.
export const STYLES = [
  ['black-and-white film still of', ['a black and white still from an old film', 'grainy black and white movie footage']],
  ['color film still of', ['a still from a color film', 'a frame from a vintage color movie']],
  ['home video of', ['a frame from an amateur home video', 'shaky camcorder footage']],
  ['TV broadcast of', ['a frame from a television broadcast with captions', 'a news broadcast screenshot']],
  ['cartoon of', ['a frame from an animated cartoon', 'a drawn animation still']],
  ['screen recording of', ['a screen recording of a computer desktop', 'a screenshot of a computer program']],
  ['video game footage of', ['a screenshot from a video game', 'video game graphics']],
  ['text on screen with', ['a title card with text', 'a frame with large text on a plain background']],
  ['webcam video of', ['a webcam video of a person talking to the camera', 'a vlog selfie video']],
  ['concert footage of', ['live concert footage on stage with lights', 'a band performing on stage']],
  ['dark frame of', ['a very dark blurry video frame', 'an almost black frame']],
  ['photo slideshow of', ['a slideshow of still photographs', 'a scanned old photograph']],
  ['meeting recording of', ['a recording of a public meeting in a council chamber', 'a video of a government meeting']],
  ['documentary footage of', ['documentary footage filmed outdoors', 'a nature documentary shot']],
];
async function styleEmbeddings() {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL, { revision: REVISION });
  const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { revision: REVISION, dtype: 'fp32', device: 'cpu' });
  const result = [];
  for (const [caption, prompts] of STYLES) {
    const { text_embeds } = await model(tokenizer(prompts, { padding: 'max_length', truncation: true }));
    const e = text_embeds.normalize(2, -1), d = e.dims[1], row = new Float64Array(d);
    for (let i = 0; i < prompts.length; i++) for (let k = 0; k < d; k++) row[k] += e.data[i * d + k];
    const norm = Math.hypot(...row);
    result.push({ caption, vector: [...row].map(x => Math.round(x / norm * 1e4) / 1e4) });
  }
  return result;
}
// --styles-only: add the kinds of footage to an existing vocabulary.json.
if (process.argv.includes('--styles-only')) {
  const file = join(OUT, 'vocabulary.json'), vocabulary = JSON.parse(readFileSync(file, 'utf8'));
  vocabulary.styles = await styleEmbeddings();
  writeFileSync(file, JSON.stringify(vocabulary));
  console.log('styles written to', file);
  process.exit(0);
}
const tags = buildVocabulary(readFileSync(RAM, 'utf8'), readFileSync(OI, 'utf8'), readFileSync('/usr/share/dict/words', 'utf8'));
console.log(tags.length, 'tags');

async function textEmbeddings() {
  const key = CACHE && join(CACHE, `text-${REVISION.slice(0, 8)}-${tags.length}.f32`);
  if (key && existsSync(key) && existsSync(key + '.json') && JSON.stringify(JSON.parse(readFileSync(key + '.json', 'utf8'))) === JSON.stringify({ tags, TEMPLATES })) {
    const buf = readFileSync(key); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  }
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL, { revision: REVISION });
  const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { revision: REVISION, dtype: 'fp32', device: 'cpu' });
  let out, dim;
  for (let i = 0; i < tags.length; i += 128) {
    const batch = tags.slice(i, i + 128), parts = [];
    for (const template of TEMPLATES) {
      const { text_embeds } = await model(tokenizer(batch.map(t => template.replace('{}', t)), { padding: 'max_length', truncation: true }));
      const e = text_embeds.normalize(2, -1); dim = e.dims[1]; parts.push(e.data);
    }
    out ??= new Float32Array(tags.length * dim);
    for (let j = 0; j < batch.length; j++) {
      const row = out.subarray((i + j) * dim, (i + j + 1) * dim);
      for (const p of parts) for (let d = 0; d < dim; d++) row[d] += p[j * dim + d];
      const n = Math.hypot(...row); for (let d = 0; d < dim; d++) row[d] /= n;
    }
    if (i % 1024 === 0) console.log('text', i, '/', tags.length);
  }
  if (key) { mkdirSync(CACHE, { recursive: true }); writeFileSync(key, Buffer.from(out.buffer)); writeFileSync(key + '.json', JSON.stringify({ tags, TEMPLATES })); }
  return out;
}

async function imageEmbeddings() {
  const processor = await AutoProcessor.from_pretrained(MODEL, { revision: REVISION });
  const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { revision: REVISION, dtype: DTYPE, device: 'cpu' });
  const files = readdirSync(FRAMES).filter(f => /^\d+\.jpg$/.test(f)).sort();
  const rows = [];
  for (const f of files) {
    const { data, info } = await sharp(join(FRAMES, f), { failOn: 'none' }).resize(384, 384, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const image = new RawImage(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, 4);
    const { image_embeds } = await model(await processor(image));
    rows.push(Float32Array.from(image_embeds.normalize(2, -1).data));
  }
  console.log(rows.length, 'frames');
  return rows;
}

const text = await textEmbeddings();
const dim = text.length / tags.length;
// Per-row symmetric int8; priors are measured on the dequantized rows the browser will use.
const q = new Int8Array(text.length), scale = new Float32Array(tags.length);
for (let t = 0; t < tags.length; t++) {
  let m = 0; for (let d = 0; d < dim; d++) m = Math.max(m, Math.abs(text[t * dim + d]));
  scale[t] = m / 127;
  for (let d = 0; d < dim; d++) q[t * dim + d] = Math.round(text[t * dim + d] / scale[t]);
}
const images = await imageEmbeddings();
const sum = new Float64Array(tags.length), sq = new Float64Array(tags.length);
for (const e of images) for (let t = 0; t < tags.length; t++) {
  let s = 0; for (let d = 0; d < dim; d++) s += e[d] * q[t * dim + d];
  s *= scale[t]; sum[t] += s; sq[t] += s * s;
}
const n = images.length, round = x => Math.round(x * 1e6) / 1e6;
const mean = [...sum].map(s => s / n), std = [...sq].map((s, t) => Math.sqrt(Math.max(s / n - mean[t] ** 2, 1e-8)));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'embeddings.bin'), Buffer.from(q.buffer));
writeFileSync(join(OUT, 'vocabulary.json'), JSON.stringify({
  model: MODEL, revision: REVISION, dtype: DTYPE, dim, candidates: CANDIDATES, count: COUNT, templates: TEMPLATES, frames: n,
  tags, scale: [...scale].map(x => +x.toPrecision(6)), mean: mean.map(round), std: std.map(round),
  styles: await styleEmbeddings(),
}));
console.log('wrote', join(OUT, 'embeddings.bin'), q.length, 'bytes;', join(OUT, 'vocabulary.json'));
