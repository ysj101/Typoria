import { expect, test, type Page } from "@playwright/test";

/**
 * 性能計測（docs/spec.md §14）。chromium のみ。
 * 閾値はヘッドレス環境の揺らぎを考慮した余裕値。計測値はレポートに attach する。
 */
test.describe("performance", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium" || test.info().project.name !== "chromium",
    "desktop chromium で計測する",
  );

  async function startPlaying(page: Page) {
    await page.goto("/");
    await page.getByRole("button", { name: "PLAY" }).click();
    await expect(page.getByTestId("game")).toHaveAttribute("data-state", "PLAYING", {
      timeout: 5_000,
    });
  }

  async function readAnswer(page: Page): Promise<string> {
    const label = await page.getByTestId("answer").getAttribute("aria-label");
    return label!.replace("入力対象: ", "");
  }

  /** keydown を dispatch してから typed の数が増えるまでの時間（ms）をページ内で計測する */
  async function measureInputToPaint(page: Page, char: string): Promise<number> {
    return page.evaluate(async (ch) => {
      const game = document.querySelector<HTMLElement>("[data-testid=game]")!;
      const count = () => document.querySelectorAll("[data-state=typed]").length;
      const before = count();
      const t0 = performance.now();
      game.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
      // 1 フレーム待ってから DOM が更新されているかを確認する
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      if (count() <= before) throw new Error("typed count did not increase within one frame");
      return performance.now() - t0;
    }, char);
  }

  test("input → paint within one frame", async ({ page }, testInfo) => {
    await startPlaying(page);
    const answer = await readAnswer(page);
    const samples: number[] = [];
    for (const ch of answer) samples.push(await measureInputToPaint(page, ch));
    const max = Math.max(...samples);
    await testInfo.attach("input-to-paint-ms", { body: JSON.stringify({ samples, max }) });
    expect(max).toBeLessThanOrEqual(32);
  });

  test("question switch within 150ms", async ({ page }, testInfo) => {
    await startPlaying(page);
    const answer = await readAnswer(page);
    const elapsed = await page.evaluate(async (ans) => {
      const game = document.querySelector<HTMLElement>("[data-testid=game]")!;
      const input = document.querySelector<HTMLElement>("[data-testid=typing-input]")!;
      const before = input.getAttribute("data-question-id");
      const chars = Array.from(ans);
      for (const ch of chars.slice(0, -1)) {
        game.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
      }
      const t0 = performance.now();
      game.dispatchEvent(new KeyboardEvent("keydown", { key: chars.at(-1)!, bubbles: true }));
      return new Promise<number>((resolve, reject) => {
        const deadline = t0 + 1000;
        const check = () => {
          const now = performance.now();
          const el = document.querySelector<HTMLElement>("[data-testid=typing-input]");
          if (el && el.getAttribute("data-question-id") !== before) return resolve(now - t0);
          if (now > deadline) return reject(new Error("question did not switch"));
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
    }, answer);
    await testInfo.attach("question-switch-ms", { body: JSON.stringify({ elapsed }) });
    expect(elapsed).toBeLessThanOrEqual(150);
  });

  test("frame interval stays near 60fps during FEVER", async ({ page }, testInfo) => {
    await startPlaying(page);
    // 10 問連続クリアして FEVER + パーティクルを出す
    for (let i = 0; i < 10; i += 1) {
      const answer = await readAnswer(page);
      const id = await page.getByTestId("typing-input").getAttribute("data-question-id");
      await page.keyboard.type(answer);
      await expect(page.getByTestId("typing-input")).not.toHaveAttribute("data-question-id", id!);
    }
    await expect(page.getByTestId("combo-display")).toHaveAttribute("data-fever", "true");

    const stats = await page.evaluate(
      () =>
        new Promise<{ avg: number; max: number; frames: number }>((resolve) => {
          const intervals: number[] = [];
          let last = performance.now();
          const step = () => {
            const now = performance.now();
            intervals.push(now - last);
            last = now;
            if (intervals.length >= 60) {
              const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
              resolve({ avg, max: Math.max(...intervals), frames: intervals.length });
              return;
            }
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
    );
    await testInfo.attach("frame-interval-ms", { body: JSON.stringify(stats) });
    expect(stats.avg).toBeLessThanOrEqual(20);
  });
});
