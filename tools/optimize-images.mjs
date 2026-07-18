import { execFile } from "node:child_process";
import {
  copyFile,
  readFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const maxLongSide = Number(process.env.MAX_LONG_SIDE || 1700);
const quality = Number(process.env.WEBP_QUALITY || 82);
const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 4));

const dataSource = await readFile(path.join(root, "projects-data.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(dataSource, context, { filename: "projects-data.js" });

const assets = new Set();
for (const project of context.window.PROJECTS || []) {
  for (const media of project.media || []) {
    if (media.type === "image" && media.src?.endsWith(".webp")) {
      assets.add(media.src);
    }
    if (media.poster?.endsWith(".webp")) assets.add(media.poster);
  }
}

async function dimensions(file) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    file,
  ]);
  const [width, height] = stdout.trim().split("x").map(Number);
  return { width, height };
}

async function optimize(relativePath) {
  const source = path.join(root, relativePath);
  const target = source.replace(/\.webp$/, "-mobile.webp");
  const { width, height } = await dimensions(source);
  const longest = Math.max(width, height);

  if (longest <= maxLongSide) {
    await copyFile(source, target);
  } else {
    const scale = maxLongSide / longest;
    const targetWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
    const targetHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
    await run("cwebp", [
      "-quiet",
      "-mt",
      "-q",
      String(quality),
      "-m",
      "6",
      "-resize",
      String(targetWidth),
      String(targetHeight),
      source,
      "-o",
      target,
    ]);
  }

  const output = await stat(target);
  return { relativePath, width, height, bytes: output.size };
}

const queue = [...assets];
const results = [];
async function worker() {
  while (queue.length) {
    const relativePath = queue.shift();
    results.push(await optimize(relativePath));
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

const totalBytes = results.reduce((sum, item) => sum + item.bytes, 0);
console.log(
  `Created ${results.length} mobile WebP files: max ${maxLongSide}px, quality ${quality}, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total.`,
);
