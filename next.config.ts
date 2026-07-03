import type { NextConfig } from "next";
import path from "node:path";

// プロジェクトルートを明示する。次の事故を防ぐ目的:
//   1. 親ディレクトリ（ホーム直下など）に lockfile が紛れていると Next.js が
//      そこをワークスペースルートと誤認識し、`outputFileTracing` が想定外の範囲を辿る
//   2. モノレポに将来取り込まれた場合でも本ディレクトリが基準になる
const projectRoot = path.resolve(__dirname);

// Vercel ではネイティブの Next.js ビルド（.next 出力）を使う。
// 静的ホスト（Surge 等）へ出力したい場合のみ NEXT_OUTPUT_EXPORT=true で
// `output: "export"`（out/ 生成）に切り替える。
const staticExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const } : {}),
  images: { unoptimized: true },
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
