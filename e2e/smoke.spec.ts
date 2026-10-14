import { expect, test } from "@playwright/test";

test("shows the junior-engineer IT terminology home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Typoria/);
  await expect(page.getByRole("heading", { name: "Typoria" })).toBeVisible();
  await expect(page.getByText("新人エンジニア向け")).toBeVisible();
  await expect(page.getByText("1 回 3 分。IT の基礎用語を読んで、打って、覚える。")).toBeVisible();
  const steps = page.getByRole("list", { name: "学習の流れ" });
  await expect(steps).toContainText("読む");
  await expect(steps).toContainText("打つ");
  await expect(steps).toContainText("クイズ");
  await expect(page.getByText("英語を学ぶ")).toHaveCount(0);
  await expect(page.getByText("90 秒")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
});
