import { expect, test } from "@playwright/test";

test("shows the junior-engineer IT terminology home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Typoria/);
  await expect(page.getByRole("heading", { name: "Typoria" })).toBeVisible();
  await expect(page.getByRole("list", { name: "学習の流れ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
});
