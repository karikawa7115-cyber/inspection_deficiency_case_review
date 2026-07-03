/** Surge: inspection デモを入口に; 200.html fallback; surge.json */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Vercel は out/ をそのまま配信するため、Surge 専用の加工（index.html 上書き・
// 200.html・surge.json 生成）は不要。Vercel 上ではスキップする。
if (process.env.VERCEL) {
  console.log("Running on Vercel — skipping Surge-specific postbuild.");
  process.exit(0);
}

const out = resolve(process.cwd(), "out");
const index = resolve(out, "index.html");
const inspection = resolve(out, "inspection.html");
const fallback = resolve(out, "200.html");

// `out/` は静的エクスポート時のみ生成される。存在しなければ何もしない。
if (!existsSync(index)) {
  console.log("out/index.html not found — skipping Surge fallback.");
  process.exit(0);
}

const entry = existsSync(inspection) ? inspection : index;
copyFileSync(entry, index);
copyFileSync(entry, fallback);

writeFileSync(
  resolve(out, "surge.json"),
  `${JSON.stringify({ cleanUrls: true }, null, 2)}\n`,
);

console.log(
  existsSync(inspection)
    ? "Surge entry: /inspection demo (copied to index.html + 200.html)."
    : "Created out/200.html for Surge.",
);
