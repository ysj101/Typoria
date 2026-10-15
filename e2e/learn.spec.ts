import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalScroll,
  expectNoSeriousViolations,
  typeChars,
  usesSoftKeyboard,
} from "./helpers";

test.describe("learn round", () => {
  test("reads, types, quizzes, and shows the learn result", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
    await page.getByRole("button", { name: "IT用語を学ぶ" }).click();
    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.getByRole("heading", { name: "IT基礎用語" })).toBeVisible();

    const names: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const learn = page.getByTestId("learn");
      await expect(learn).toHaveAttribute("data-phase", "reading");
      await expect(page.getByTestId("learn-progress")).toHaveText(`${i + 1} / 3`);
      const explanation = page.getByTestId("learn-explanation");
      await expect(explanation).toBeVisible();
      const explanationText = (await explanation.textContent()) ?? "";
      expect(explanationText.length).toBeGreaterThan(0);
      names.push((await page.getByTestId("learn-name").textContent()) ?? "");

      await page.getByRole("button", { name: "打つ" }).click();
      await expect(learn).toHaveAttribute("data-phase", "typing");
      await expect(explanation).toHaveText(explanationText);
      await expect(explanation).toBeInViewport();
      await expect(page.getByTestId("learn-answer")).toBeInViewport();

      const label = await page.getByTestId("learn-answer").getAttribute("aria-label");
      const answer = (label ?? "").replace("入力対象: ", "");
      expect(answer.length).toBeGreaterThan(0);
      await typeChars(page, answer);
    }

    expect(new Set(names).size).toBe(3);
    await expect(page.getByTestId("learn")).toHaveAttribute("data-phase", "roundEnd");
    await expect(page.getByRole("heading", { name: "ラウンド完了" })).toBeVisible();
    for (const name of names) {
      await expect(page.getByTestId("learn-learned")).toContainText(name);
    }

    await page.getByRole("button", { name: "理解度クイズへ" }).click();
    const learn = page.getByTestId("learn");
    await expect(learn).toHaveAttribute("data-phase", "quiz");
    const choices = page.getByTestId("learn-quiz-choice");
    await expect(choices).toHaveCount(4);
    const choiceTexts = (await choices.allTextContents()).map((text) => text.trim());
    const boxes = await choices.evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { height: box.height, width: box.width };
      }),
    );
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalScroll(page);
    await expectNoSeriousViolations(page, "Learn quiz");

    if (usesSoftKeyboard()) {
      await choices.first().click();
    } else {
      await expect(choices.first()).toBeFocused();
      await page.keyboard.press("Enter");
    }

    const feedback = page.getByTestId("learn-quiz-feedback");
    await expect(feedback).toBeVisible();
    const judgment = ((await page.getByTestId("learn-quiz-judgment").textContent()) ?? "").trim();
    expect(judgment).toMatch(/^(正解|不正解)$/);
    const correctText = (
      (await page.getByTestId("learn-quiz-correct-answer").textContent()) ?? ""
    ).trim();
    expect(correctText.length).toBeGreaterThan(0);
    expect(choiceTexts).toContain(correctText);
    const explanation = (
      (await page.getByTestId("learn-quiz-explanation").textContent()) ?? ""
    ).trim();
    expect(explanation.length).toBeGreaterThan(0);
    await expectNoSeriousViolations(page, "Learn quiz feedback");

    await page.getByRole("button", { name: "結果へ" }).click();
    await expect(page).toHaveURL(/#\/result$/);
    await expect(page.getByRole("heading", { name: "今日学んだ用語" })).toBeVisible();
    for (const name of names) {
      await expect(page.getByTestId("learn-result")).toContainText(name);
    }
    await expect(page.getByTestId("learn-result-quiz")).toContainText(judgment);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousViolations(page, "Learn result");

    await page.getByRole("button", { name: "ホームへ" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  });

  test("keeps the explanation and typing target inside a short visual viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 360 });
    await page.goto("/");
    await page.getByRole("button", { name: "IT用語を学ぶ" }).click();
    await page.getByRole("button", { name: "打つ" }).click();
    await expect(page.getByTestId("learn")).toHaveAttribute("data-phase", "typing");
    await expect(page.getByTestId("learn")).toHaveAttribute("data-compact", "true");

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
          const published = document.documentElement.style.getPropertyValue("--vvh").trim();
          return published === `${height}px` && height > 0 && height <= 400;
        }),
      )
      .toBe(true);

    const boxes = await page.evaluate(() => {
      const vv = window.visualViewport;
      const top = vv?.offsetTop ?? 0;
      const bottom = top + (vv?.height ?? window.innerHeight);
      const rect = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const box = el.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, height: box.height, width: box.width };
      };
      return {
        top,
        bottom,
        explanation: rect("[data-testid=learn-explanation]"),
        answer: rect("[data-testid=learn-answer]"),
      };
    });

    expect(boxes.explanation).not.toBeNull();
    expect(boxes.answer).not.toBeNull();
    for (const box of [boxes.explanation!, boxes.answer!]) {
      expect(box.height).toBeGreaterThan(0);
      expect(box.width).toBeGreaterThan(0);
      expect(box.top).toBeGreaterThanOrEqual(boxes.top - 1);
      expect(box.bottom).toBeLessThanOrEqual(boxes.bottom + 1);
    }
  });
});
