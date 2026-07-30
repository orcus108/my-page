import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CONFIG } from "./lib/site-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = path.join(rootDir, "site", "sitemap.xml");
const sitemap = await fs.readFile(sitemapPath, "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

if (!urlList.length) throw new Error("No URLs found in site/sitemap.xml. Run npm run build first.");

const siteUrl = new URL(urlList[0]);
if (urlList.some((url) => new URL(url).origin !== siteUrl.origin)) {
  throw new Error("Sitemap contains URLs from more than one origin.");
}
const payload = {
  host: siteUrl.hostname,
  key: SITE_CONFIG.indexNowKey,
  keyLocation: `${siteUrl.origin}/${SITE_CONFIG.indexNowKey}.txt`,
  urlList,
};

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`IndexNow returned ${response.status}: ${detail || response.statusText}`);
}

console.log(`Submitted ${urlList.length} canonical URLs to IndexNow (${response.status}).`);
