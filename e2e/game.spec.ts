import { expect, test } from "@playwright/test";
import { typeChars } from "./helpers";

test.describe("game screen", () => {
  test("counts down, accepts typing and clears a question", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "PLAY" }).click();
    const game = page.getByTestId("game");
    await expect(game).toHaveAttribute("data-state", "COUNTDOWN");
    await expect(page.getByTestId("countdown")).toBeVisible();
    await expect(game).toHaveAttribute("data-state", "PLAYING", { timeout: 5_000 });

    const answer = (await page.getByTestId("answer").getAttribute("aria-label"))!.replace(
      "入力対象: ",
      "",
    );
    const questionId = await page.getByTestId("typing-input").getAttribute("data-question-id");
    await typeChars(page, answer);
    await expect(page.getByTestId("combo-value")).toHaveText("1");
    await expect(page.getByTestId("typing-input")).not.toHaveAttribute(
      "data-question-id",
      questionId!,
    );

    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-state", "PAUSED");
    await expect(page.getByRole("dialog", { name: "一時停止" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-state", "PLAYING");
  });
});
