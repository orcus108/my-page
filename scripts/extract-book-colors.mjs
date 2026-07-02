#!/usr/bin/env node
/**
 * Compute a representative dominant colour for each book cover and write it into
 * books.json as `color`, so the CSS-rendered spine matches its cover.
 *
 * Heuristic: decode the cover, quantise pixels into colour buckets, and score
 * each bucket by frequency weighted toward saturation (so a vivid accent beats a
 * large flat background). Near-white and near-black pixels are ignored when a
 * colourful option exists, which keeps white-background covers from yielding a
 * washed-out spine. Falls back to the dominant neutral for black-and-white covers.
 *
 * Usage: node scripts/extract-book-colors.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const previewDir = path.join(root, "content", "preview");
const booksJsonPath = path.join(previewDir, "books.json");

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const rgbToHex = (r, g, b) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function dominantColor(data, width, height) {
  const buckets = new Map();
  const total = width * height;
  // sample up to ~6000 pixels for speed
  const step = Math.max(1, Math.floor(total / 6000));
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    const a = data[o + 3];
    if (a < 200) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const nearWhite = min > 232;
    const nearBlack = max < 26;
    // quantise to 32-level buckets
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    let e = buckets.get(key);
    if (!e) {
      e = { count: 0, r: 0, g: 0, b: 0, neutralOnly: true };
      buckets.set(key, e);
    }
    e.count++;
    e.r += r;
    e.g += g;
    e.b += b;
    if (!nearWhite && !nearBlack) e.neutralOnly = false;
  }

  let best = null;
  let bestScore = -1;
  let bestNeutral = null;
  let bestNeutralScore = -1;
  for (const e of buckets.values()) {
    const r = e.r / e.count, g = e.g / e.count, b = e.b / e.count;
    const sat = saturation(r, g, b);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const isExtreme = min > 232 || max < 26;
    // favour colourful, reasonably common buckets
    const score = e.count * (0.18 + sat * 1.9);
    if (!isExtreme && score > bestScore) {
      bestScore = score;
      best = { r, g, b };
    }
    // neutral fallback: most common mid-tone bucket
    const neutralScore = e.count * (1 - Math.abs((r + g + b) / 3 - 128) / 128);
    if (neutralScore > bestNeutralScore) {
      bestNeutralScore = neutralScore;
      bestNeutral = { r, g, b };
    }
  }

  const pick = best || bestNeutral || { r: 51, g: 56, b: 74 };
  return rgbToHex(pick.r, pick.g, pick.b);
}

const books = JSON.parse(await fs.readFile(booksJsonPath, "utf8"));
let updated = 0;

for (const b of books) {
  if (!b.coverFile) {
    console.log(`  skip ${b.slug}: no cover`);
    continue;
  }
  const coverPath = path.join(previewDir, b.coverFile);
  try {
    const buf = await fs.readFile(coverPath);
    const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 512 });
    const hex = dominantColor(img.data, img.width, img.height);
    const prev = b.color;
    b.color = hex;
    updated++;
    console.log(`  ${b.slug}: ${prev || "—"} -> ${hex}`);
  } catch (e) {
    console.log(`  ${b.slug}: FAILED (${e.message})`);
  }
}

await fs.writeFile(booksJsonPath, JSON.stringify(books, null, 2) + "\n");
console.log(`\nUpdated ${updated}/${books.length} book colours.`);
