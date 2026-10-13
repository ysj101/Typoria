import { expect, test } from "@playwright/test";

test("shows the placeholder title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Typoria" })).toBeVisible();
});
