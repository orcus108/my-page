import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEIGHTS = [400, 500, 600, 700];
const FONT_PKG = path.join(__dirname, "../../node_modules/@fontsource/plus-jakarta-sans/files");

export function fontFaceCss() {
  return WEIGHTS
    .map((weight) => {
      const file = `plus-jakarta-sans-latin-${weight}-normal.woff2`;
      return `@font-face{font-family:"Plus Jakarta Sans";font-style:normal;font-weight:${weight};font-display:swap;src:url("fonts/${file}") format("woff2");}`;
    })
    .join("");
}

export async function copyFonts(destDir) {
  const fontsDir = path.join(destDir, "fonts");
  await fs.mkdir(fontsDir, { recursive: true });
  for (const weight of WEIGHTS) {
    const file = `plus-jakarta-sans-latin-${weight}-normal.woff2`;
    await fs.copyFile(path.join(FONT_PKG, file), path.join(fontsDir, file));
  }
}

export function fontPreloads(rootPrefix = "") {
  return [400, 600]
    .map(
      (weight) =>
        `<link rel="preload" href="${rootPrefix}assets/fonts/plus-jakarta-sans-latin-${weight}-normal.woff2" as="font" type="font/woff2" crossorigin />`
    )
    .join("\n    ");
}
