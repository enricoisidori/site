import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const source = await fs.readFile(path.join(root, "projects-data.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);

function variants(media) {
  const desktop = media.src;
  const mobile = media.type === "image"
    ? desktop.replace(/\.webp$/, "-mobile.webp")
    : desktop.endsWith("-optimized.mp4")
      ? desktop.replace(/-optimized\.mp4$/, "-mobile.mp4")
      : desktop.replace(/\.mp4$/, "-mobile.mp4");
  return [
    { relative: desktop, target: 1700, kind: media.type },
    { relative: mobile, target: 1080, kind: media.type },
  ];
}

const targets = new Map();
for (const project of context.window.PROJECTS) {
  for (const media of project.media) {
    for (const variant of variants(media)) targets.set(variant.relative, variant);
    if (media.poster) {
      targets.set(media.poster, { relative: media.poster, target: 1700, kind: "image" });
      const mobilePoster = media.poster.replace(/\.webp$/, "-mobile.webp");
      targets.set(mobilePoster, { relative: mobilePoster, target: 1080, kind: "image" });
    }
  }
}

async function probe(file) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,width,height:format=bit_rate",
    "-of", "json",
    file,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.find((item) => item.codec_type === "video") ?? data.streams?.[0] ?? {};
  return {
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    bitRate: Number(data.format?.bit_rate) || 0,
  };
}

async function replaceIfValid(sourceFile, temporaryFile) {
  await probe(temporaryFile);
  await fs.rename(temporaryFile, sourceFile);
}

async function optimizeImage(item) {
  const file = path.join(root, item.relative);
  const before = await fs.stat(file);
  const dimensions = await probe(file);
  const shouldResize = Math.max(dimensions.width, dimensions.height) > item.target;
  const shouldCompress = before.size > 700_000;
  if (!shouldResize && !shouldCompress) return null;

  const temporary = `${file}.codex-tmp.webp`;
  const args = ["-quiet", "-mt", "-m", "6", "-q", "80", "-metadata", "none"];
  if (shouldResize) {
    if (dimensions.width >= dimensions.height) args.push("-resize", String(item.target), "0");
    else args.push("-resize", "0", String(item.target));
  }
  args.push(file, "-o", temporary);
  await execFileAsync("cwebp", args);
  await replaceIfValid(file, temporary);
  const after = await fs.stat(file);
  return { file: item.relative, before: before.size, after: after.size };
}

async function optimizeVideo(item) {
  const file = path.join(root, item.relative);
  const before = await fs.stat(file);
  const dimensions = await probe(file);
  const shouldResize = Math.max(dimensions.width, dimensions.height) > item.target;
  const shouldCompress = before.size > 5_000_000;
  if (!shouldResize && !shouldCompress) return null;

  const temporary = `${file}.codex-tmp.mp4`;
  const scale = shouldResize
    ? `scale='if(gte(iw,ih),${item.target},-2)':'if(gte(iw,ih),-2,${item.target})'`
    : "null";
  const pixelRatio = shouldResize
    ? (item.target / Math.max(dimensions.width, dimensions.height)) ** 2
    : 1;
  const reduction = shouldResize ? Math.max(0.55, pixelRatio ** 0.7) : 0.72;
  const cap = item.target === 1080 ? 1_400_000 : 2_500_000;
  const targetBitRate = Math.max(
    250_000,
    Math.round(Math.min(dimensions.bitRate * reduction, cap)),
  );
  const encode = (videoBitRate, audioBitRate) => execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", file,
      "-map", "0:v:0", "-map", "0:a?",
      "-vf", scale,
      "-c:v", "libx264", "-preset", "slow",
      "-b:v", String(videoBitRate),
      "-maxrate", String(Math.round(videoBitRate * 1.5)),
      "-bufsize", String(videoBitRate * 2),
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", audioBitRate,
      "-movflags", "+faststart",
      "-map_metadata", "-1",
      temporary,
    ], { maxBuffer: 1024 * 1024 });
  await encode(targetBitRate, "128k");
  await probe(temporary);
  let candidate = await fs.stat(temporary);
  if (candidate.size >= before.size && shouldResize) {
    await fs.unlink(temporary);
    const retryBitRate = Math.max(
      160_000,
      Math.round(targetBitRate * (before.size / candidate.size) * 0.8),
    );
    await encode(retryBitRate, "64k");
    await probe(temporary);
    candidate = await fs.stat(temporary);
  }
  if (candidate.size >= before.size) {
    await fs.unlink(temporary);
    throw new Error(`Refusing larger output for ${item.relative}`);
  }
  await fs.rename(temporary, file);
  return { file: item.relative, before: before.size, after: candidate.size };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results.filter(Boolean);
}

const items = [];
for (const item of targets.values()) {
  try {
    await fs.stat(path.join(root, item.relative));
    items.push(item);
  } catch {
    console.warn(`Missing: ${item.relative}`);
  }
}
const imageResults = await mapLimit(items.filter((item) => item.kind === "image"), 6, optimizeImage);
console.log(`Images optimized: ${imageResults.length}`);

const videoResults = [];
for (const item of items.filter((entry) => entry.kind === "video")) {
  const result = await optimizeVideo(item);
  if (result) {
    videoResults.push(result);
    console.log(`Video ${videoResults.length}: ${result.file}`);
  }
}

const results = [...imageResults, ...videoResults];
const before = results.reduce((sum, result) => sum + result.before, 0);
const after = results.reduce((sum, result) => sum + result.after, 0);
console.log(`Optimized ${results.length} Work assets: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
