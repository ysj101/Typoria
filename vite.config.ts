import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

/**
 * 配信ベースパス。GitHub Pages は `/Typoria/`。
 * 未設定（ローカル開発・E2E）は `/`。先頭と末尾の `/` は補う。
 */
function resolveBasePath(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw || raw === "/") return "/";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const base = resolveBasePath(process.env.VITE_BASE_PATH);

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // manifest の icons は globPatterns で拾うため、自動追加による precache の重複を避ける
      includeManifestIcons: false,
      manifest: {
        name: "Typoria",
        short_name: "Typoria",
        description: "タイピングで英語を学ぶ 90 秒のゲーム",
        lang: "ja",
        start_url: base,
        scope: base,
        display: "standalone",
        theme_color: "#0B1026",
        background_color: "#0B1026",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // JS / CSS / フォント（woff2 のみ。対応ブラウザはすべて woff2 対応）/ アイコン / JSON / 音源を precache する（§14, AC-20）
        // questions.json は JS にバンドルされるため個別エントリは無い
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json,mp3,wav,ogg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // precache の URL は SW と同じディレクトリ相対（例: index.html）。
        // base 付きの絶対パスにすると `/Typoria/sw.js` から解決した index.html と一致する。
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
