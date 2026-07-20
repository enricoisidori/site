import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const mediaExtensions = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp4",
  ".png",
  ".svg",
  ".webp",
]);

async function walk(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(absolute)));
    else if (mediaExtensions.has(path.extname(entry.name).toLowerCase())) {
      output.push(absolute);
    }
  }
  return output;
}

function loadProjects() {
  const source = requireText(path.join(root, "projects-data.js"));
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.PROJECTS;
}

function requireText(file) {
  return globalThis.__files.get(file);
}

function workUsage(projects) {
  const usage = new Map();
  for (const project of projects) {
    project.media.forEach((media, index) => {
      const desktop = media.src;
      const mobile = media.type === "image"
        ? desktop.replace(/\.webp$/, "-mobile.webp")
        : desktop.endsWith("-optimized.mp4")
          ? desktop.replace(/-optimized\.mp4$/, "-mobile.mp4")
          : desktop.replace(/\.mp4$/, "-mobile.mp4");
      const role = index === 0 ? "cover+first" : `gallery-${index + 1}`;
      usage.set(desktop, `${project.slug}:${role}:desktop`);
      usage.set(mobile, `${project.slug}:${role}:mobile`);
      if (media.poster) {
        usage.set(media.poster, `${project.slug}:poster:desktop`);
        usage.set(
          media.poster.replace(/\.webp$/, "-mobile.webp"),
          `${project.slug}:poster:mobile`,
        );
      }
    });
  }
  return usage;
}

async function probe(file) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=codec_name,codec_type,width,height,pix_fmt:format=duration,bit_rate",
      "-of", "json",
      file,
    ], { maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout);
    const stream = data.streams?.find((item) => item.codec_type === "video") ?? data.streams?.[0] ?? {};
    return {
      codec: stream.codec_name ?? "",
      width: Number(stream.width) || 0,
      height: Number(stream.height) || 0,
      pixFmt: stream.pix_fmt ?? "",
      duration: Number(data.format?.duration) || 0,
      bitRate: Number(data.format?.bit_rate) || 0,
    };
  } catch {
    return { codec: "", width: 0, height: 0, pixFmt: "", duration: 0, bitRate: 0 };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function recommendation(row) {
  const extension = row.extension;
  const target = row.variant === "mobile" ? 1080 : 1700;
  const notes = [];
  if (["jpg", "jpeg", "png"].includes(extension)) notes.push("convert-webp");
  if (extension === "gif") notes.push("convert-video");
  if (extension === "mov") notes.push("convert-mp4");
  if (row.workUsage && row.longSide > target) notes.push(`resize-${target}`);
  if (row.workUsage && row.kind === "image" && row.bytes > 700_000) notes.push("recompress-image");
  const videoBitRateLimit = row.variant === "mobile" ? 1_800 : 3_000;
  if (
    row.workUsage &&
    row.kind === "video" &&
    row.bitRateKbps > videoBitRateLimit
  ) notes.push("recompress-video");
  return notes.join("+") || "ok";
}

globalThis.__files = new Map([
  [path.join(root, "projects-data.js"), await fs.readFile(path.join(root, "projects-data.js"), "utf8")],
]);
const projects = loadProjects();
delete globalThis.__files;
const usage = workUsage(projects);
const files = (await walk(root)).sort();

const rows = await mapLimit(files, 8, async (absolute) => {
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  const stat = await fs.stat(absolute);
  const metadata = await probe(absolute);
  const extension = path.extname(relative).slice(1).toLowerCase();
  const usageLabel = usage.get(relative) ?? "";
  const variant = usageLabel.endsWith(":mobile") || relative.includes("-mobile.") ? "mobile" : "desktop/source";
  const kind = ["mp4", "mov"].includes(extension) ? "video" : "image";
  const row = {
    path: relative,
    kind,
    extension,
    codec: metadata.codec,
    bytes: stat.size,
    megabytes: (stat.size / 1_000_000).toFixed(3),
    width: metadata.width,
    height: metadata.height,
    longSide: Math.max(metadata.width, metadata.height),
    duration: metadata.duration ? metadata.duration.toFixed(2) : "",
    bitRateKbps: metadata.bitRate ? Math.round(metadata.bitRate / 1000) : "",
    pixFmt: metadata.pixFmt,
    variant,
    workUsage: usageLabel,
  };
  row.recommendation = recommendation(row);
  return row;
});

const headers = [
  "path", "kind", "extension", "codec", "bytes", "megabytes", "width", "height",
  "longSide", "duration", "bitRateKbps", "pixFmt", "variant", "workUsage", "recommendation",
];
const csvOutput = [headers.join(","), ...rows.map((row) => headers.map((key) => csv(row[key])).join(","))].join("\n") + "\n";
await fs.writeFile(path.join(root, "media-audit.csv"), csvOutput);

const workRows = rows.filter((row) => row.workUsage);
const largeWorkRows = workRows.filter((row) => row.recommendation !== "ok");
const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
const workBytes = workRows.reduce((sum, row) => sum + row.bytes, 0);
const byExtension = Object.entries(Object.groupBy(rows, (row) => row.extension))
  .map(([extension, items]) => ({ extension, count: items.length, bytes: items.reduce((sum, row) => sum + row.bytes, 0) }))
  .sort((a, b) => b.bytes - a.bytes);
const largestRows = [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, 40);
const largestWorkRows = [...workRows].sort((a, b) => b.bytes - a.bytes).slice(0, 40);

const markdown = [
  "# Media audit",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- Media files: ${rows.length}`,
  `- Repository media weight: ${(totalBytes / 1_000_000_000).toFixed(2)} GB`,
  `- Work-referenced variants found: ${workRows.length}`,
  `- Work-referenced variants weight: ${(workBytes / 1_000_000).toFixed(1)} MB`,
  `- Work variants requiring attention: ${largeWorkRows.length}`,
  "",
  "## Weight by format",
  "",
  "| Format | Files | Weight (MB) |",
  "|---|---:|---:|",
  ...byExtension.map((item) => `| ${item.extension} | ${item.count} | ${(item.bytes / 1_000_000).toFixed(1)} |`),
  "",
  "## Largest files in the repository",
  "",
  "| File | Size | Dimensions | Format | Status |",
  "|---|---:|---:|---|---|",
  ...largestRows.map((row) => `| ${row.path} | ${row.megabytes} MB | ${row.width}×${row.height} | ${row.extension}/${row.codec} | ${row.workUsage || "not referenced by Work"} |`),
  "",
  "## Largest files served by Work",
  "",
  "| File | Size | Dimensions | Bitrate | Use |",
  "|---|---:|---:|---:|---|",
  ...largestWorkRows.map((row) => `| ${row.path} | ${row.megabytes} MB | ${row.width}×${row.height} | ${row.bitRateKbps || "—"} kbps | ${row.workUsage} |`),
  "",
  "## Work assets requiring attention",
  "",
  "| File | Use | Size | Dimensions | Codec | Recommendation |",
  "|---|---|---:|---:|---|---|",
  ...largeWorkRows
    .sort((a, b) => b.bytes - a.bytes)
    .map((row) => `| ${row.path} | ${row.workUsage} | ${row.megabytes} MB | ${row.width}×${row.height} | ${row.codec} | ${row.recommendation} |`),
  "",
  "The complete one-file-per-row inventory is in `media-audit.csv`.",
  "",
].join("\n");
await fs.writeFile(path.join(root, "MEDIA-AUDIT.md"), markdown);

console.log(`Audited ${rows.length} files; ${largeWorkRows.length} Work variants need attention.`);
