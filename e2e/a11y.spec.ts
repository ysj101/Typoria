import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** 重大とみなす impact（docs/spec.md §14: 重大な違反がゼロ） */
const SERIOUS = ["serious", "critical"];

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => SERIOUS.includes(v.impact ?? ""));
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `${label} に重大な a11y 違反`,
  ).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function waitForPlaying(page: Page) {
  const game = page.getByTestId("game");
  await expect(game).toHaveAttribute("data-state", "PLAYING", { timeout: 6_000 });
  return game;
}

/** route state を注入して Result 画面を開く */
async function openResult(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const session = {
      id: "a11y",
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
    // react-router は history.state.usr に state を保持する
    window.history.pushState({ usr: payload, key: "a11y", idx: 1 }, "", "#/result");
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  });
  await expect(page.getByRole("button", { name: /PLAY AGAIN/i })).toBeVisible();
}

test.describe("accessibility (axe)", () => {
  test("Home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
    await expectNoSeriousViolations(page, "Home");
  });

  test("Game: countdown, playing, paused", async ({ page }) => {
    await page.goto("/#/game");
    const game = page.getByTestId("game");
    await expect(game).toHaveAttribute("data-state", "COUNTDOWN");
    await expectNoSeriousViolations(page, "Game(countdown)");
    await waitForPlaying(page);
    await expectNoSeriousViolations(page, "Game(playing)");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "一時停止" })).toBeVisible();
    await expectNoSeriousViolations(page, "Game(paused)");
  });

  test("Result", async ({ page }) => {
    await openResult(page);
    await expectNoSeriousViolations(page, "Result");
    await expect(page.getByRole("button", { name: /PLAY AGAIN/i })).toBeFocused();
  });

  test("History", async ({ page }) => {
    await page.goto("/#/history");
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expectNoSeriousViolations(page, "History");
  });

  test("Settings", async ({ page }) => {
    await page.goto("/#/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expectNoSeriousViolations(page, "Settings");
  });
});

test.describe("home fits one screen at 360px", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("no horizontal scroll and the home stays within the viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
    await expect(page.getByRole("list", { name: "学習の流れ" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    const overflowY = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(overflowY).toBeLessThanOrEqual(0);
  });
});

test.describe("mobile width (375px) has no horizontal scroll", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const path of ["/", "/#/history", "/#/settings"]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("/#/game", async ({ page }) => {
    await page.goto("/#/game");
    await waitForPlaying(page);
    await expectNoHorizontalScroll(page);
  });

  test("/#/result", async ({ page }) => {
    await openResult(page);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("keyboard", () => {
  test("pause dialog traps focus and restores it on resume", async ({ page }) => {
    await page.goto("/#/game");
    const game = await waitForPlaying(page);
    await page.keyboard.press("Escape");
    const resume = page.getByRole("button", { name: "再開" });
    const quit = page.getByRole("button", { name: "やめる" });
    await expect(resume).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(quit).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(resume).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(quit).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-state", "PLAYING");
    // 再開後はゲーム領域内の入力欄へ戻す（ソフトキーボードを再び開けるようにする）
    await expect(page.getByTestId("soft-keyboard-input")).toBeFocused();
  });

  test("Home reaches Game with a single Enter (§4.1)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game")).toBeVisible();
  });

  test("Home links are reachable by Tab in order", async ({ page, browserName }) => {
    // Safari（WebKit）は既定で Tab がリンクに止まらず Option+Tab で移動する（ブラウザ仕様）
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY" })).toBeFocused();
    await page.keyboard.press(tab);
    await expect(page.getByRole("link", { name: "学習履歴" })).toBeFocused();
    await page.keyboard.press(tab);
    await expect(page.getByRole("link", { name: "設定" })).toBeFocused();
  });
});
