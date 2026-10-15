import { defineConfig, devices } from "@playwright/test";

/**
 * 公開 URL（GitHub Pages）に対して、インストール済みの Google Chrome 安定版で実行する設定（#62）。
 * `scripts/e2e-public.sh` から使う。testDir はサブパスを前置して生成した e2e-public/。
 */
export default defineConfig({
  testDir: "./e2e-public",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.PUBLIC_URL ?? "https://ysj101.github.io/Typoria/",
    trace: "retain-on-failure",
  },
  projects: [{ name: "macos-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});
