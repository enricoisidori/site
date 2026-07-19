import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const dataSource = await readFile(path.join(root, "projects-data.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(dataSource, context, { filename: "projects-data.js" });

const assets = Array.from(
  new Set(
    (context.window.PROJECTS || []).flatMap((project) =>
      [
        ...project.media
          .filter((media) => media.type === "image" && media.src?.endsWith(".webp"))
          .map((media) => media.src),
        project.media[0]?.poster,
      ].filter((asset) => asset?.endsWith(".webp")),
    ),
  ),
);

const tempDir = await mkdtemp(path.join(os.tmpdir(), "site-placeholders-"));
const placeholders = {};
const queue = [...assets];

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
  return stdout.trim().split("x").map(Number);
}

async function worker() {
  while (queue.length) {
    const relativePath = queue.shift();
    const source = path.join(root, relativePath);
    const target = path.join(tempDir, `${Buffer.from(relativePath).toString("hex")}.webp`);
    const [width, height] = await dimensions(source);
    const scale = 24 / Math.max(width, height);
    const targetWidth = Math.max(2, Math.round(width * scale));
    const targetHeight = Math.max(2, Math.round(height * scale));

    await run("cwebp", [
      "-quiet",
      "-q",
      "18",
      "-m",
      "6",
      "-resize",
      String(targetWidth),
      String(targetHeight),
      source,
      "-o",
      target,
    ]);

    const encoded = (await readFile(target)).toString("base64");
    placeholders[relativePath] = `data:image/webp;base64,${encoded}`;
  }
}

try {
  await Promise.all(Array.from({ length: 4 }, worker));
  const sorted = Object.fromEntries(
    Object.entries(placeholders).sort(([a], [b]) => a.localeCompare(b)),
  );
  const output = `window.PROJECT_PLACEHOLDERS = ${JSON.stringify(sorted)};\n`;
  await writeFile(path.join(root, "projects-placeholders.js"), output);
  console.log(`Created ${assets.length} embedded LQIP placeholders.`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
