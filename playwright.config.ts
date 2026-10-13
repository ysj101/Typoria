import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  // 既定（pnpm test:e2e / CI）は chromium と mobile-chrome。
  // webkit（Safari 相当）は pnpm test:e2e:all に残す。
  // Edge は Chromium ベースのため chromium の結果で代替する（docs/verification.md）。
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Pixel 7 は hasTouch: true / isMobile: true。対象ブラウザは Chrome のみ（#61）。
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
