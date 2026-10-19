/**
 * 公開 URL をインストール済みの Google Chrome 安定版で開き、E2E では観測しにくい項目を確認する（#62）。
 * - PLAY 押下後に AudioContext が running になり currentTime が進む（効果音・BGM の unlock）
 * - Service Worker が activated で、scope が公開 URL のサブパスになっている
 * - manifest の start_url / scope / display / icons（インストール可能判定の前提）
 * 実行: node scripts/verify-public.mjs [URL]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://ysj101.github.io/Typoria/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.addInitScript(() => {
  const Original = window.AudioContext;
  window.__audioContexts = [];
  window.AudioContext = class extends Original {
    constructor(...args) {
      super(...args);
      window.__audioContexts.push(this);
    }
  };
});
await page.goto(url);
const userAgent = await page.evaluate(() => navigator.userAgent);
const beforePlay = await page.evaluate(() => window.__audioContexts.map((ctx) => ctx.state));
await page.getByRole("button", { name: "PLAY" }).click();
await page.waitForTimeout(4_000);
const afterPlay = await page.evaluate(() =>
  window.__audioContexts.map((ctx) => ({ state: ctx.state, currentTime: ctx.currentTime })),
);
const serviceWorker = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  return { scope: registration.scope, state: registration.active?.state ?? null };
});
const manifest = await page.evaluate(async () => {
  const link = document.querySelector("link[rel=manifest]");
  const data = await (await fetch(link.href)).json();
  return {
    start_url: data.start_url,
    scope: data.scope,
    display: data.display,
    icons: data.icons.map((icon) => `${icon.sizes}${icon.purpose ? ` ${icon.purpose}` : ""}`),
  };
});
await browser.close();
console.log(
  JSON.stringify({ url, userAgent, beforePlay, afterPlay, serviceWorker, manifest }, null, 2),
);
