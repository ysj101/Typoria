import { expect, test } from "@playwright/test";

test("AC-20 オフラインでもプレイできる（初回読み込み後）", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Typoria" })).toBeVisible();

  // Service Worker の登録・precache 完了と、ページが SW の制御下に入るのを待つ
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state === "activated";
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Typoria" })).toBeVisible();
  await context.setOffline(false);
});
