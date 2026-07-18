const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const home = fs.readFileSync(path.join(root, "home.html"), "utf8");

function textFromHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function slugFromTitle(title) {
  return title
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mediaFromHtml(projectPath, html) {
  const media = [];
  const mediaPattern = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>|<video\b([^>]*)>([\s\S]*?)<\/video>/gi;
  let match;

  while ((match = mediaPattern.exec(html))) {
    if (match[1]) {
      const src = `${projectPath}/${match[1]}`;
      if (fs.existsSync(path.join(root, src))) {
        media.push({ type: "image", src });
      }
      continue;
    }

    const source = (match[3].match(/<source\b[^>]*\bsrc="([^"]+)"/i) || [])[1];
    if (!source) continue;

    const poster = (match[2].match(/\bposter="([^"]+)"/i) || [])[1];
    const src = `${projectPath}/${source}`;
    if (fs.existsSync(path.join(root, src))) {
    const previousOpen = html.lastIndexOf("<div", match.index);
    const previousClose = html.lastIndexOf("</div>", match.index);
    const wrapperOpen =
      previousOpen > previousClose
        ? html.slice(previousOpen, html.indexOf(">", previousOpen) + 1)
        : "";
    const unmute =
      /class="[^"]*\bvideo-unmute\b[^"]*"/i.test(match[2]) ||
      /class="[^"]*\bvideo-unmute\b[^"]*"/i.test(wrapperOpen);

    media.push({
      type: "video",
      src,
      unmute,
      ...(poster ? { poster: `${projectPath}/${poster}` } : {}),
    });
    }
  }

  return media;
}

const projects = [];
const homeProjectPattern = /<a href="([^"]+)"\s*>\s*<div class="([^"]*?(?:artistpage|designerpage)[^"]*)"[^>]*>[\s\S]*?<p class="thumb">([\s\S]*?)<\/p>/g;
let match;

while ((match = homeProjectPattern.exec(home))) {
  const projectPath = match[1].replace(/\/$/, "");
  const projectFile = path.join(root, projectPath, "index.html");
  const source = fs
    .readFileSync(projectFile, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "");
  const title = textFromHtml(match[3]);
  const descriptionText = textFromHtml(
    (source.match(/<p class="description">([\s\S]*?)<\/p>/i) || [])[1] || "",
  );
  const descriptionLines = descriptionText.split("\n");
  const date = /^\d{4}(?:[—-].*)?$/.test(descriptionLines[0] || "")
    ? descriptionLines.shift()
    : "";
  const info = [...source.matchAll(/<p class="outdent">([\s\S]*?)<\/p>/gi)]
    .map((entry) => textFromHtml(entry[1]))
    .filter(Boolean);

  const media = mediaFromHtml(projectPath, source);
  if (!media.length) {
    const thumbnail = (match[0].match(/<img\b[^>]*\bsrc="([^"]+)"/i) || [])[1];
    if (thumbnail && fs.existsSync(path.join(root, thumbnail))) {
      media.push({ type: "image", src: thumbnail });
    }
  }

  projects.push({
    slug: slugFromTitle(title),
    sourcePage: `${projectPath}/`,
    title,
    categories: match[2]
      .split(/\s+/)
      .filter((className) => /page$/.test(className)),
    date,
    info,
    description: descriptionLines.join("\n"),
    media,
  });
}

fs.writeFileSync(
  path.join(root, "projects-data.js"),
  `window.PROJECTS = ${JSON.stringify(projects, null, 2)};\n`,
);

console.log(`Generated ${projects.length} projects in projects-data.js.`);
