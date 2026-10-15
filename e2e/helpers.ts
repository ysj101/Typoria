import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

export const COUNTDOWN_MS = 3_000;
export const GAME_DURATION_MS = 90_000;
export const RESULT_TRANSITION_MS = 400;

/** 偽装クロックを導入する。`page.goto` の前に呼ぶ */
export async function installClock(page: Page, time = new Date("2026-10-13T10:00:00")) {
  await page.clock.install({ time });
}

/** ホームから PLAY を押してカウントダウンを抜け、PLAYING にする（偽装クロック前提） */
export async function startGame(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY" }).click();
  const game = page.getByTestId("game");
  await expect(game).toHaveAttribute("data-state", "COUNTDOWN");
  await page.clock.runFor(COUNTDOWN_MS + 50);
  await expect(game).toHaveAttribute("data-state", "PLAYING");
  await expect(page.getByTestId("typing-input")).toBeVisible();
  return game;
}

export async function readAnswer(page: Page): Promise<string> {
  const label = await page.getByTestId("answer").getAttribute("aria-label");
  return (label ?? "").replace("入力対象: ", "");
}

export async function currentQuestionId(page: Page): Promise<string> {
  return (await page.getByTestId("typing-input").getAttribute("data-question-id")) ?? "";
}

export function typedCount(page: Page) {
  return page.getByTestId("answer").locator("span[data-state=typed]");
}

/** mobile-chrome はソフトキーボード（insertText）。desktop は物理キー（#61） */
export function usesSoftKeyboard(): boolean {
  return test.info().project.name === "mobile-chrome";
}

/**
 * 解答の文字を入れる。
 * mobile-chrome では `page.keyboard.type` を使わず、フォーカス中の input へ `insertText` する。
 */
export async function typeChars(page: Page, text: string) {
  if (!usesSoftKeyboard()) {
    await page.keyboard.type(text);
    return;
  }
  const input = page.getByTestId("soft-keyboard-input");
  await input.focus();
  for (const ch of text) await page.keyboard.insertText(ch);
}

/** 現在の問題を誤入力なしで打ち切る */
export async function typeAnswer(page: Page) {
  const id = await currentQuestionId(page);
  const answer = await readAnswer(page);
  await typeChars(page, answer);
  await expect(page.getByTestId("typing-input")).not.toHaveAttribute("data-question-id", id);
}

export async function clearQuestions(page: Page, n: number) {
  for (let i = 0; i < n; i += 1) await typeAnswer(page);
}

/** 90 秒進めて FINISHED → Result 画面へ遷移させる */
export async function finishGame(page: Page) {
  await page.clock.fastForward(GAME_DURATION_MS + 100);
  // 保存（IndexedDB）は非同期。runFor 中に遷移まで済む場合と、RESULT で止まる場合がある
  await expect
    .poll(async () => {
      if (/#\/result$/.test(page.url())) return "navigated";
      return (await page.getByTestId("game").getAttribute("data-state")) ?? "";
    })
    .toMatch(/navigated|RESULT/);
  if (!/#\/result$/.test(page.url())) await page.clock.runFor(RESULT_TRANSITION_MS + 50);
  await expect(page).toHaveURL(/#\/result$/);
  await expect(page.getByTestId("result-view")).toBeVisible();
}

/** 1 プレイを通しで行う（n 問クリア → 時間切れ → Result） */
export async function playGame(page: Page, solve = 1) {
  await startGame(page);
  await clearQuestions(page, solve);
  await finishGame(page);
}

/** Result の演出を完了させる */
export async function finishResultAnimation(page: Page) {
  await page.clock.runFor(2_500);
  await expect(page.getByTestId("result-view")).toHaveAttribute("data-animation-done", "true");
}

export function wrongCharFor(answer: string): string {
  const first = answer[0]?.toLowerCase();
  return first === "z" ? "x" : "z";
}

/** IndexedDB に保存された設定を読む（保存完了を待つための確認用） */
export async function readStoredSettings(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        const req = indexedDB.open("typoria");
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const get = db.transaction("settings").objectStore("settings").get("settings");
            get.onsuccess = () => {
              db.close();
              resolve((get.result as Record<string, unknown> | undefined) ?? null);
            };
            get.onerror = () => {
              db.close();
              resolve(null);
            };
          } catch {
            db.close();
            resolve(null);
          }
        };
      }),
  );
}

/** 設定の保存が IndexedDB に反映されるまで待つ（reload 前に呼ぶ） */
export async function waitForStoredSettings(page: Page, expected: Record<string, unknown>) {
  await expect
    .poll(async () => {
      const stored = await readStoredSettings(page);
      if (!stored) return false;
      return Object.entries(expected).every(([k, v]) => stored[k] === v);
    })
    .toBe(true);
}

/** 重大とみなす impact（docs/spec.md §14: 重大な違反がゼロ） */
const SERIOUS = ["serious", "critical"];

export async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => SERIOUS.includes(v.impact ?? ""));
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `${label} に重大な a11y 違反`,
  ).toEqual([]);
}

async function expectNoOverflow(page: Page, axis: "x" | "y") {
  const overflow = await page.evaluate((axis) => {
    const root = document.documentElement;
    return axis === "x"
      ? root.scrollWidth - root.clientWidth
      : root.scrollHeight - root.clientHeight;
  }, axis);
  expect(overflow, `${axis} 方向にはみ出し`).toBeLessThanOrEqual(0);
}

export const expectNoHorizontalScroll = (page: Page) => expectNoOverflow(page, "x");
export const expectNoVerticalScroll = (page: Page) => expectNoOverflow(page, "y");
