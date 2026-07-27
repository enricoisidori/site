#!/usr/bin/env node

/**
 * Samples the same Wikimedia Commons endpoint used by Aleph and writes data
 * that can be inspected locally, without involving an LLM.
 *
 * Usage:
 *   node tools/sample-aleph-commons.mjs --count 500
 *   node tools/sample-aleph-commons.mjs --count 500 --batch-size 1
 *
 * The default batch size (6) matches Aleph's normal Commons refill. A batch
 * size of 1 is useful as a control sample of independent API starts.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_URL = "https://commons.wikimedia.org/w/api.php";
const DEFAULT_COUNT = 500;
const DEFAULT_BATCH_SIZE = 6;
const CATEGORY_LIMIT = 20;
const REQUEST_DELAY_MS = 1_250;
const MAX_RETRIES = 5;

function readNumberOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number.parseInt(process.argv[index + 1], 10);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readStringOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

const count = readNumberOption("--count", DEFAULT_COUNT);
const batchSize = Math.min(
  readNumberOption("--batch-size", DEFAULT_BATCH_SIZE),
  500,
);
const outputDirectory = resolve(
  readStringOption("--output", "tmp/aleph-commons-sample"),
);
const recordsPath = resolve(outputDirectory, "records.json");
const checkpointPath = resolve(outputDirectory, "checkpoint.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiUrl(limit) {
  const params = new URLSearchParams({
    action: "query",
    generator: "random",
    grnnamespace: "6",
    grnlimit: String(limit),
    prop: "imageinfo|categories",
    iiprop: "url|mime",
    iiurlwidth: "128",
    cllimit: String(CATEGORY_LIMIT),
    format: "json",
    origin: "*",
  });
  return `${API_URL}?${params}`;
}

async function fetchBatch(limit) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(apiUrl(limit), {
        headers: { "user-agent": "AlephCommonsSampler/1.0 (local analysis)" },
      });
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after"), 10);
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1_000
          : attempt * 5_000;
        process.stderr.write(`\nRate limited; waiting ${Math.round(waitMs / 1000)}s…\n`);
        await sleep(waitMs);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.info || data.error.code);
      // Aleph iterates the `pages` object directly. Object.values preserves
      // that same JavaScript property order (numeric page IDs in ascending
      // order), so this sampler measures the exact client-side ordering.
      return Object.values(data.query?.pages || {});
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(attempt * 2_000);
    }
  }
  throw lastError;
}

function normalisedInitial(title) {
  const name = title.replace(/^File:/i, "").trim();
  const first = Array.from(name)[0] || "?";
  return /[A-Za-z]/.test(first) ? first.toUpperCase() : "#";
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map, limit = 40) {
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, occurrences]) => ({ label, occurrences }));
}

async function restoreCheckpoint() {
  try {
    const raw = await readFile(checkpointPath, "utf8");
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved.filter((record) => Number.isInteger(record?.pageId));
  } catch {
    return [];
  }
}

await mkdir(outputDirectory, { recursive: true });
const records = (await restoreCheckpoint()).slice(0, count);
const seenIds = new Set(records.map((record) => record.pageId));
let apiBatches = records.reduce(
  (highest, record) => Math.max(highest, record.apiBatch || 0),
  0,
);

while (records.length < count) {
  const pages = await fetchBatch(Math.min(batchSize, count - records.length));
  apiBatches += 1;

  // The API order is retained deliberately: it lets us measure any
  // within-batch sequence rather than hiding it.
  for (const [position, page] of pages.entries()) {
    const image = page.imageinfo?.[0];
    if (!page.title || !image?.url || !image.mime?.startsWith("image/")) continue;
    if (seenIds.has(page.pageid)) continue;

    seenIds.add(page.pageid);
    records.push({
      sampleIndex: records.length + 1,
      apiBatch: apiBatches,
      batchPosition: position + 1,
      pageId: page.pageid,
      title: page.title,
      initial: normalisedInitial(page.title),
      mime: image.mime,
      url: image.thumburl || image.url,
      categories: (page.categories || []).map((category) =>
        category.title.replace(/^Category:/i, ""),
      ),
    });
    if (records.length === count) break;
  }

  process.stderr.write(`\rCollected ${records.length}/${count} images`);
  await writeFile(checkpointPath, `${JSON.stringify(records, null, 2)}\n`);
  if (records.length < count) await sleep(REQUEST_DELAY_MS);
}

const initials = new Map();
const categories = new Map();
const mimeTypes = new Map();
const byBatch = new Map();

for (const record of records) {
  increment(initials, record.initial);
  increment(mimeTypes, record.mime);
  increment(byBatch, String(record.apiBatch));
  for (const category of record.categories) increment(categories, category);
}

const summary = {
  generatedAt: new Date().toISOString(),
  method: {
    endpoint: API_URL,
    generator: "random",
    namespace: 6,
    requestedCount: count,
    batchSize,
    categoryLimitPerFile: CATEGORY_LIMIT,
    note: "Batch positions are retained to test the API's fixed within-batch sequence.",
  },
  result: {
    records: records.length,
    uniquePageIds: seenIds.size,
    apiBatches,
    initials: topEntries(initials, 40),
    mimeTypes: topEntries(mimeTypes, 20),
    topCategories: topEntries(categories, 50),
    recordsPerBatch: topEntries(byBatch, apiBatches),
  },
};

await Promise.all([
  writeFile(recordsPath, `${JSON.stringify(records, null, 2)}\n`),
  writeFile(
    resolve(outputDirectory, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  ),
]);

process.stderr.write("\n");
console.log(`Saved ${records.length} records to ${outputDirectory}`);
