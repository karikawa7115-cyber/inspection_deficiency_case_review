/** Surge: inspection デモを入口に; 200.html fallback; surge.json */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.cwd(), "out");
const index = resolve(out, "index.html");
const inspection = resolve(out, "inspection.html");
const fallback = resolve(out, "200.html");

if (!existsSync(index)) {
  console.error("out/index.html not found. Run npm run build first.");
  process.exit(1);
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
