import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

/**
 * スマホ Chrome 固有の受け入れ（#61）。
 * Pixel 7（hasTouch / isMobile）の mobile-chrome プロジェクトでのみ実行する。
 */

test.describe("mobile chrome", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium" || test.info().project.name !== "mobile-chrome",
    "mobile-chrome のみ",
  );

  test("ゲーム開始でソフトキーボード用 input にフォーカスが当たる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "PLAY" }).click();
    const input = page.getByTestId("soft-keyboard-input");
    const game = page.getByTestId("game");
    await expect(game).toHaveAttribute("data-state", "COUNTDOWN");
    await expect(input).toBeFocused();
    await expect(game).toHaveAttribute("data-state", "PLAYING", { timeout: 6_000 });
    await expect(input).toBeFocused();
  });

  test("insertText で 1 問クリアできる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "PLAY" }).click();
    const game = page.getByTestId("game");
    await expect(game).toHaveAttribute("data-state", "PLAYING", { timeout: 6_000 });

    const typing = page.getByTestId("typing-input");
    const id = await typing.getAttribute("data-question-id");
    const answer = (await page.getByTestId("answer").getAttribute("aria-label"))!.replace(
      "入力対象: ",
      "",
    );
    const input = page.getByTestId("soft-keyboard-input");
    await input.focus();
    // 物理キーの keydown ではなく、ソフトキーボード相当の insertText
    for (const ch of answer) await page.keyboard.insertText(ch);

    await expect(typing).not.toHaveAttribute("data-question-id", id!);
    await expect(page.getByTestId("combo-value")).toHaveText("1");
  });

  test("縦持ちで横スクロールしない", async ({ page }) => {
    await expectNoHorizontalScrollOnScreens(page);
  });

  test("横持ちで横スクロールしない", async ({ page }) => {
    await page.setViewportSize({ width: 839, height: 412 });
    await expectNoHorizontalScrollOnScreens(page);
  });

  test("主要ボタンのタップ領域が 44×44px 以上", async ({ page }) => {
    await expectMainTapTargets(page);
    await page.setViewportSize({ width: 839, height: 412 });
    await expectMainTapTargets(page);
  });
});

async function expectNoHorizontalScrollOnScreens(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Typoria" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/#/game");
  await expect(page.getByTestId("game")).toHaveAttribute("data-state", "PLAYING", {
    timeout: 6_000,
  });
  await expectNoHorizontalScroll(page);

  await openResult(page);
  await expectNoHorizontalScroll(page);
}

async function expectMinTap(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectMainTapTargets(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await expectMinTap(page.getByRole("button", { name: "PLAY" }));
  await expectMinTap(page.getByRole("link", { name: "学習履歴" }));
  await expectMinTap(page.getByRole("link", { name: "設定" }));

  await page.goto("/#/game");
  await expect(page.getByTestId("game")).toHaveAttribute("data-state", "PLAYING", {
    timeout: 6_000,
  });
  await expectMinTap(page.getByRole("button", { name: "一時停止" }));
  await expectMinTap(page.getByRole("button", { name: "キーボードを開く" }));
  await expectMinTap(page.getByRole("button", { name: "スキップ" }));

  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectMinTap(page.getByRole("link", { name: "ホームへ戻る" }));
  await expectMinTap(page.getByRole("button", { name: "JSON をエクスポート" }));
  await expectMinTap(page.getByRole("switch", { name: "効果音" }));

  await openResult(page);
  await expectMinTap(page.getByRole("button", { name: "PLAY AGAIN" }));
  await expectMinTap(page.getByRole("button", { name: "BACK TO HOME" }));
}

/** route state を注入して Result 画面を開く */
async function openResult(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const session = {
      id: "mobile",
      startedAt: now,
      completedAt: now,
      difficulty: "normal",
      score: 1230,
      maxCombo: 7,
      solved: 8,
      skipped: 1,
      perfectSolved: 5,
      correctKeystrokes: 60,
      incorrectKeystrokes: 3,
      xpEarned: 70,
      results: [],
    };
    const payload = {
      session,
      isNewRecord: true,
      missionRewards: [{ id: "play_once", rewardXP: 20 }],
      nextDifficulty: "hard",
      streak: 3,
    };
    window.history.pushState({ usr: payload, key: "mobile", idx: 1 }, "", "#/result");
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  });
  await expect(page.getByRole("button", { name: /PLAY AGAIN/i })).toBeVisible();
}
