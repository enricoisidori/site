import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(resolve(root, "projects-data.js"), "utf8"), context);

const videos = context.window.PROJECTS.flatMap((project) => project.media).filter(
  (media) => media.type === "video",
);

function outputPath(source, suffix) {
  return source.slice(0, -extname(source).length) + suffix + ".mp4";
}

function hasAudio(source) {
  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      source,
    ],
    { encoding: "utf8" },
  );
  return output.trim().length > 0;
}

function videoInfo(source) {
  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=avg_frame_rate:format=duration",
      "-of",
      "json",
      source,
    ],
    { encoding: "utf8" },
  );
  const data = JSON.parse(output);
  const [numerator, denominator] = data.streams[0].avg_frame_rate
    .split("/")
    .map(Number);
  return {
    duration: Number(data.format.duration),
    fps: denominator ? numerator / denominator : numerator,
  };
}

function remuxWithoutAudio(source, destination) {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      source,
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      "-an",
      "-map_metadata",
      "-1",
      "-movflags",
      "+faststart",
      destination,
    ],
    { stdio: "inherit" },
  );
}

function encode(source, destination, maxSize, crf, keepAudio, targetFps) {
  if (existsSync(destination) && !process.argv.includes("--force")) return;

  const args = [
    "-y",
    "-i",
    source,
    "-vf",
    `${targetFps ? `fps=${targetFps},` : ""}scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    "-map_metadata",
    "-1",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  if (keepAudio && hasAudio(source)) {
    args.push("-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(destination);
  console.log(`${source} -> ${destination}`);
  execFileSync("ffmpeg", args, { stdio: "inherit" });

  if (statSync(destination).size < statSync(source).size) return;
  if (!keepAudio && hasAudio(source)) {
    remuxWithoutAudio(source, destination);
    return;
  }

  unlinkSync(destination);
  console.log(`Discarded larger output: ${destination}`);
}

for (const media of videos) {
  const sourcePath = media.src.replace(/-optimized\.mp4$/, ".mp4");
  const source = resolve(root, sourcePath);
  if (sourcePath.endsWith("/cover.mp4")) continue;
  const info = videoInfo(source);
  const targetFps = info.duration >= 45 && info.fps > 30 ? 30 : null;

  encode(
    source,
    outputPath(source, "-optimized"),
    1920,
    targetFps ? 27 : 24,
    media.unmute,
    targetFps,
  );
  encode(
    source,
    outputPath(source, "-mobile"),
    1280,
    targetFps ? 30 : 28,
    media.unmute,
    targetFps,
  );
}
