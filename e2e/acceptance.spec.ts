import { expect, test, type Page } from "@playwright/test";
import {
  GAME_DURATION_MS,
  clearQuestions,
  currentQuestionId,
  finishGame,
  finishResultAnimation,
  installClock,
  playGame,
  readAnswer,
  startGame,
  typeAnswer,
  typedCount,
  waitForStoredSettings,
  wrongCharFor,
} from "./helpers";

test.describe("受け入れ基準 §16", () => {
  test.beforeEach(async ({ page }) => {
    await installClock(page);
  });

  test("AC-01 PLAY で 3 秒カウントダウン後にゲームが始まる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "PLAY" }).click();
    const game = page.getByTestId("game");
    await expect(game).toHaveAttribute("data-state", "COUNTDOWN");
    await expect(page.getByTestId("countdown")).toHaveText("3");
    await page.clock.runFor(1_050);
    await expect(page.getByTestId("countdown")).toHaveText("2");
    await page.clock.runFor(1_000);
    await expect(page.getByTestId("countdown")).toHaveText("1");
    await page.clock.runFor(1_000);
    await expect(game).toHaveAttribute("data-state", "PLAYING");
    await expect(page.getByTestId("countdown")).toHaveCount(0);
    await expect(page.getByTestId("hud-time")).toHaveText("01:30");
  });

  test("AC-02 90 秒経過でゲームが終了しリザルトへ遷移する", async ({ page }) => {
    const game = await startGame(page);
    await page.clock.fastForward(GAME_DURATION_MS - 1_000);
    await expect(game).toHaveAttribute("data-state", "PLAYING");
    await expect(page.getByTestId("hud-time")).toHaveText("00:01");
    await finishGame(page);
  });

  test("AC-03 正しい文字でカーソルが進み、誤った文字では進まない", async ({ page }) => {
    await startGame(page);
    const answer = await readAnswer(page);
    await page.keyboard.type(wrongCharFor(answer));
    await expect(typedCount(page)).toHaveCount(0);
    await expect(page.getByTestId("answer")).toHaveAttribute("data-last-input", "incorrect");
    await page.keyboard.type(answer[0]!);
    await expect(typedCount(page)).toHaveCount(1);
    await expect(page.getByTestId("answer")).toHaveAttribute("data-last-input", "correct");
  });

  test("AC-04 誤入力後に正しい文字で続行できる", async ({ page }) => {
    await startGame(page);
    const id = await currentQuestionId(page);
    const answer = await readAnswer(page);
    await page.keyboard.type(answer[0]!);
    await page.keyboard.type(wrongCharFor(answer));
    await expect(typedCount(page)).toHaveCount(1);
    await page.keyboard.type(answer.slice(1));
    await expect(page.getByTestId("typing-input")).not.toHaveAttribute("data-question-id", id);
    // 誤入力があったので PERFECT ではない（easy 100 点）
    await expect(page.getByTestId("hud-score")).toHaveText("100");
  });

  test("AC-05 全文字入力で次の問題に進む", async ({ page }) => {
    await startGame(page);
    const id = await currentQuestionId(page);
    await typeAnswer(page);
    expect(await currentQuestionId(page)).not.toBe(id);
    await expect(typedCount(page)).toHaveCount(0);
  });

  test("AC-06 スコアが §6 の計算式どおりに加算される", async ({ page }) => {
    await startGame(page);
    await typeAnswer(page);
    // easy 100 × 1.0 + PERFECT 30
    await expect(page.getByTestId("hud-score")).toHaveText("130");
    await clearQuestions(page, 4);
    // 5 コンボ目: floor(100 × 1.2) + 30 = 150 → 合計 130×4 + 150 = 670
    await expect(page.getByTestId("hud-score")).toHaveText("670");
  });

  test("AC-07 スキップでコンボが 0 になり次の問題に進む", async ({ page }) => {
    await startGame(page);
    await typeAnswer(page);
    await expect(page.getByTestId("combo-value")).toHaveText("1");
    const id = await currentQuestionId(page);
    await page.keyboard.press("Control+Enter");
    await expect(page.getByTestId("combo-value")).toHaveText("0");
    expect(await currentQuestionId(page)).not.toBe(id);
  });

  test("AC-08 10 コンボで FEVER 表示になる", async ({ page }) => {
    await startGame(page);
    await clearQuestions(page, 9);
    await expect(page.getByTestId("combo-display")).toHaveAttribute("data-fever", "false");
    await typeAnswer(page);
    await expect(page.getByTestId("combo-value")).toHaveText("10");
    await expect(page.getByTestId("combo-display")).toHaveAttribute("data-fever", "true");
  });

  test("AC-09 リザルトに星・スコア・Accuracy・Best Combo・Solved・XP が表示される", async ({
    page,
  }) => {
    await playGame(page, 3);
    await finishResultAnimation(page);
    await expect(page.getByTestId("star")).toHaveCount(5);
    await expect(page.locator("[data-testid=star][data-lit=true]")).toHaveCount(5);
    await expect(page.getByTestId("score-display")).toHaveText("390");
    await expect(page.getByTestId("accuracy")).toContainText("100");
    await expect(page.getByTestId("best-combo")).toContainText("3");
    await expect(page.getByTestId("solved")).toContainText("3");
    // XP = 20 + 3×5 + 3×2 = 41（+ ミッション「1 回プレイ」20）
    await expect(page.getByTestId("xp-earned")).toContainText("61");
  });

  test("AC-10 リロード後も記録（IndexedDB）が残る", async ({ page }) => {
    await playGame(page, 2);
    await page.goto("/#/");
    await page.reload();
    await expect(page.getByTestId("home-best")).toHaveText("260");
    await expect(page.getByTestId("home-xp")).not.toHaveText("0 XP");
    await page.goto("/#/history");
    await expect(page.getByTestId("stat-total-sessions")).toHaveText("1 回");
  });

  test("AC-11 成績に応じて次回難易度が変わる", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-difficulty")).toHaveText("Easy");
    await playGame(page, 5);
    await finishResultAnimation(page);
    await expect(page.getByTestId("next-difficulty")).toContainText("Normal");
    await page.goto("/#/");
    await expect(page.getByTestId("home-difficulty")).toHaveText("Normal");
  });

  test("AC-12 連続日プレイで Streak が増える", async ({ page }) => {
    await playGame(page, 1);
    await page.goto("/#/");
    await expect(page.getByTestId("home-streak")).toHaveText("1 日");
    await expect(page.getByTestId("home-today")).toHaveText("プレイ済み");

    await page.clock.setSystemTime(new Date("2026-10-14T09:00:00"));
    await page.reload();
    await expect(page.getByTestId("home-today")).toHaveText("未プレイ");
    await playGame(page, 1);
    await page.goto("/#/");
    await expect(page.getByTestId("home-streak")).toHaveText("2 日");
  });

  test("AC-13 デイリーミッションの達成で報酬 XP が 1 日 1 回付与される", async ({ page }) => {
    await playGame(page, 1);
    await finishResultAnimation(page);
    await expect(page.getByTestId("mission-rewards")).toContainText("1 回プレイする");
    await expect(page.getByTestId("mission-rewards")).toContainText("+20 XP");
    await page.goto("/#/");
    await expect(page.getByTestId("mission-play_once")).toHaveAttribute("data-completed", "true");

    await playGame(page, 1);
    await finishResultAnimation(page);
    await expect(page.getByTestId("mission-rewards")).toHaveCount(0);
  });

  test("AC-15 Esc で一時停止し、時間が止まる", async ({ page }) => {
    const game = await startGame(page);
    await page.clock.runFor(5_000);
    await expect(page.getByTestId("hud-time")).toHaveText("01:25");
    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-state", "PAUSED");
    await expect(page.getByRole("dialog", { name: "一時停止" })).toBeVisible();
    await page.clock.fastForward(20_000);
    await expect(page.getByTestId("hud-time")).toHaveText("01:25");
    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-state", "PLAYING");
    await page.clock.runFor(5_000);
    await expect(page.getByTestId("hud-time")).toHaveText("01:20");
  });

  test("AC-16 IME 変換中の入力で誤判定しない", async ({ page }) => {
    await startGame(page);
    const answer = await readAnswer(page);
    const first = answer[0]!;
    await page.evaluate((key) => {
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key, isComposing: true, bubbles: true, cancelable: true }),
      );
      const legacy = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      Object.defineProperty(legacy, "keyCode", { get: () => 229 });
      target.dispatchEvent(legacy);
    }, first);
    await expect(typedCount(page)).toHaveCount(0);
    await expect(page.getByTestId("answer")).toHaveAttribute("data-last-input", "none");
    await page.keyboard.type(first);
    await expect(typedCount(page)).toHaveCount(1);
  });

  test("AC-18 リザルトの演出中でも Enter で PLAY AGAIN できる", async ({ page }) => {
    await playGame(page, 1);
    await expect(page.getByTestId("result-view")).toHaveAttribute("data-animation-done", "false");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/game$/);
    await expect(page.getByTestId("game")).toHaveAttribute("data-state", "COUNTDOWN");
  });
});

/** AudioContext の生成とオシレーターの start 回数を記録する */
async function recordAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __audio: { contexts: number; oscillators: number };
      AudioContext: typeof AudioContext;
    };
    w.__audio = { contexts: 0, oscillators: 0 };
    const Original = w.AudioContext;
    if (!Original) return;
    class Recording extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        w.__audio.contexts += 1;
      }
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (when?: number) => {
          w.__audio.oscillators += 1;
          start(when);
        };
        return osc;
      }
    }
    w.AudioContext = Recording;
  });
}

test.describe("受け入れ基準 §16（設定）", () => {
  test("AC-14 設定で効果音 OFF にすると無音になる", async ({ page }) => {
    await recordAudio(page);
    await installClock(page);
    await page.goto("/#/settings");
    const sfx = page.getByRole("switch", { name: "効果音" });
    await expect(sfx).toHaveAttribute("aria-checked", "true");
    await sfx.click();
    await expect(sfx).toHaveAttribute("aria-checked", "false");
    const bgm = page.getByRole("switch", { name: "BGM" });
    await bgm.click();
    await expect(bgm).toHaveAttribute("aria-checked", "false");
    // 表示の切り替えは同期だが IndexedDB への保存は非同期。保存前に reload すると書き込みが失われる
    await waitForStoredSettings(page, { sfxEnabled: false, bgmEnabled: false });

    await page.reload();
    await expect(page.getByRole("switch", { name: "効果音" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await startGame(page);
    await clearQuestions(page, 2);
    await page.keyboard.type("z");
    const audio = await page.evaluate(
      () => (window as unknown as { __audio: { oscillators: number } }).__audio,
    );
    expect(audio.oscillators).toBe(0);
  });

  test("AC-17 設定でパーティクル OFF にすると表示されない", async ({ page }) => {
    await installClock(page);
    await page.goto("/#/settings");
    const particles = page.getByRole("switch", { name: "パーティクル" });
    await particles.click();
    await expect(particles).toHaveAttribute("aria-checked", "false");
    await waitForStoredSettings(page, { particles: false });
    await startGame(page);
    await clearQuestions(page, 3);
    await expect(page.getByTestId("particles")).toHaveCount(0);
  });

  test("AC-19 エクスポート → インポートで同じデータが復元される", async ({ page, browser }) => {
    await installClock(page);
    await playGame(page, 2);
    await page.goto("/#/");
    const xp = await page.getByTestId("home-xp").textContent();
    const best = await page.getByTestId("home-best").textContent();
    expect(best).toBe("260");

    await page.goto("/#/settings");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "JSON をエクスポート" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^typoria-export-\d{8}\.json$/);
    const path = await download.path();

    // 別の context（空の IndexedDB）でインポートする
    const context = await browser.newContext();
    const fresh = await context.newPage();
    await fresh.goto("/#/");
    await expect(fresh.getByTestId("home-best")).toHaveText("0");
    await fresh.goto("/#/settings");
    await fresh.getByLabel("JSON をインポート").setInputFiles(path);
    await expect(fresh.getByRole("group", { name: "インポートの確認" })).toBeVisible();
    await fresh.getByRole("button", { name: "置き換える" }).click();
    await expect(fresh.getByRole("status")).toContainText("インポートが完了しました");
    await fresh.goto("/#/");
    await expect(fresh.getByTestId("home-best")).toHaveText(best!);
    await expect(fresh.getByTestId("home-xp")).toHaveText(xp!);
    await fresh.goto("/#/history");
    await expect(fresh.getByTestId("stat-total-sessions")).toHaveText("1 回");
    await context.close();
  });

  test("AC-19 不正な JSON のインポートは拒否される", async ({ page }) => {
    await page.goto("/#/settings");
    await page.getByLabel("JSON をインポート").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version": 999}'),
    });
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
