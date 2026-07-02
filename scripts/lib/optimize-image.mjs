import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RASTER_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export function isRasterImage(filePath) {
  return RASTER_EXTS.has(path.extname(filePath).toLowerCase());
}

export async function optimizeImage(srcPath, destPath, options = {}) {
  const {
    maxWidth = null,
    maxHeight = null,
    quality = 82,
    effort = 4,
  } = options;

  await fs.mkdir(path.dirname(destPath), { recursive: true });

  const ext = path.extname(destPath).toLowerCase();
  const outPath =
    ext === ".webp" ? destPath : destPath.replace(/\.[^.]+$/, ".webp");

  let pipeline = sharp(srcPath, { failOn: "none" });
  const meta = await pipeline.metadata();

  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  await pipeline
    .webp({ quality, effort, smartSubsample: true })
    .toFile(outPath);

  const outStat = await fs.stat(outPath);
  const inStat = await fs.stat(srcPath);
  if (outStat.size >= inStat.size && ext !== ".webp") {
    await fs.copyFile(srcPath, destPath);
    await fs.rm(outPath, { force: true }).catch(() => {});
    return destPath;
  }

  return outPath;
}

export function collectMarkdownImages(text) {
  const refs = new Set();
  if (!text) return refs;
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = re.exec(text))) {
    const src = match[1].trim().replace(/^['"]|['"]$/g, "").split(/\s/)[0];
    if (src && !src.startsWith("http")) refs.add(src.replace(/^\.?\//, ""));
  }
  return refs;
}

export class ImagePipeline {
  constructor(rootDir, outputRoot) {
    this.rootDir = rootDir;
    this.outputRoot = outputRoot;
    this.map = new Map();
  }

  publicPath(outputRel) {
    return `/${outputRel.replace(/^\/+/, "")}`;
  }

  async ingest(srcRel, outputRel, options = {}) {
    const key = srcRel.replace(/^\.?\//, "");
    if (this.map.has(key)) return this.map.get(key);

    const srcAbs = path.join(this.rootDir, key);
    const destAbs = path.join(this.outputRoot, outputRel.replace(/\.[^.]+$/, ".webp"));
    let result;

    try {
      result = await optimizeImage(srcAbs, destAbs, options);
    } catch {
      await fs.mkdir(path.dirname(destAbs), { recursive: true });
      const fallback = path.join(this.outputRoot, outputRel);
      await fs.copyFile(srcAbs, fallback);
      result = fallback;
    }

    const rel = path.relative(this.outputRoot, result).split(path.sep).join("/");
    const publicPath = this.publicPath(rel);
    this.map.set(key, publicPath);
    return publicPath;
  }

  rewriteHtml(html, depth = 2) {
    let out = html;
    const prefix = depth === 1 ? "" : "../";
    for (const [src, dest] of this.map) {
      const clean = src.replace(/^\.?\//, "");
      const webp = dest.replace(/^\.?\//, "").replace(/^\//, "");
      const rel = `${prefix}${webp}`;
      out = out.split(`/${clean}`).join(rel);
    }
    return out;
  }

  rewriteSrc(src, depth = 2) {
    const key = src.replace(/^\.?\//, "").replace(/^\//, "");
    const dest = this.map.get(key);
    if (!dest) return src;
    const webp = dest.replace(/^\.?\//, "").replace(/^\//, "");
    const prefix = depth === 1 ? "" : "../";
    return `${prefix}${webp}`;
  }
}
