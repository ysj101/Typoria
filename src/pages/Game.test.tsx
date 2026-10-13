import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../app/AppContext";
import { routes } from "../app/router";
import { createMemoryStorage } from "../app/storage";
import { ROUTES } from "../app/navigation";
import { createEngine } from "../game/engine";
import { createQuestionPicker, createSeededRng } from "../game/questions";
import { Game, type GameDatabase } from "./Game";
import {
  COUNTDOWN_MS,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  GAME_DURATION_MS,
  type GameSession,
  type Question,
} from "../types/game";

const QUESTIONS: Question[] = [
  {
    id: "easy-001",
    type: "word",
    difficulty: "easy",
    japanese: "りんご",
    english: "apple",
    answer: "apple",
    tags: ["noun"],
  },
  {
    id: "easy-002",
    type: "fill_blank",
    difficulty: "easy",
    japanese: "私は学生です",
    english: "I _____ a student.",
    answer: "am",
    tags: ["be-verb"],
  },
  {
    id: "easy-003",
    type: "word",
    difficulty: "easy",
    japanese: "ねこ",
    english: "cat",
    answer: "cat",
    tags: ["noun"],
  },
];

function createFakeDatabase(): GameDatabase & { sessions: GameSession[] } {
  const sessions: GameSession[] = [];
  let progress = { ...DEFAULT_PROGRESS };
  return {
    sessions,
    saveSession: async (s) => {
      sessions.push(s);
    },
    getProgress: async () => progress,
    putProgress: async (p) => {
      progress = p;
    },
    getSettings: async () => DEFAULT_SETTINGS,
    getQuestionStats: async () => [],
    bulkPutQuestionStats: async () => {},
    getMission: async () => undefined,
    putMission: async () => {},
  };
}

/** 仮想時計で動くエンジンを注入する */
function createClock() {
  let t = 0;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

function renderGame(clock: ReturnType<typeof createClock>, database = createFakeDatabase()) {
  const createGameEngine = ({
    difficulty,
    questions,
  }: {
    difficulty: "easy" | "normal" | "hard";
    questions: Question[];
  }) =>
    createEngine({
      picker: createQuestionPicker({ questions, difficulty, rng: createSeededRng(7) }),
      difficulty,
      now: clock.now,
      generateId: () => "s-test",
    });
  // Game ルートの要素をテスト用 props 付きに差し替える
  const testRoutes = routes.map((root) => ({
    ...root,
    children: root.children?.map((r) =>
      r.path === "game"
        ? {
            ...r,
            element: (
              <Game database={database} questions={QUESTIONS} createGameEngine={createGameEngine} />
            ),
          }
        : r,
    ),
  }));
  const testRouter = createMemoryRouter(testRoutes as RouteObject[], {
    initialEntries: [ROUTES.game],
  });
  render(
    <AppProvider storage={createMemoryStorage({ settings: { difficultyMode: "easy" } })}>
      <RouterProvider router={testRouter} />
    </AppProvider>,
  );
  return { router: testRouter, database };
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** rAF を 1 フレーム進める */
async function frame(clock: ReturnType<typeof createClock>, ms = 16) {
  clock.advance(ms);
  await act(async () => {
    vi.advanceTimersToNextFrame();
  });
}

async function startPlaying(clock: ReturnType<typeof createClock>) {
  await flushAsync();
  expect(screen.getByTestId("countdown")).toBeInTheDocument();
  await frame(clock, COUNTDOWN_MS);
  expect(screen.getByTestId("game")).toHaveAttribute("data-state", "PLAYING");
}

describe("Game page (§4.2, AC-01〜AC-05, AC-15)", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the countdown then the first question", async () => {
    const clock = createClock();
    renderGame(clock);
    await flushAsync();
    expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    await frame(clock, 1_000);
    expect(screen.getByTestId("countdown")).toHaveTextContent("2");
    await frame(clock, 2_000);
    expect(screen.queryByTestId("countdown")).not.toBeInTheDocument();
    expect(screen.getByTestId("typing-input")).toBeInTheDocument();
    expect(screen.getByTestId("hud-time")).toHaveTextContent("01:30");
  });

  it("updates the display synchronously on key input (AC-03, AC-04)", async () => {
    const clock = createClock();
    renderGame(clock);
    await startPlaying(clock);
    const game = screen.getByTestId("game");
    const answer = screen
      .getByTestId("answer")
      .getAttribute("aria-label")!
      .replace("入力対象: ", "");
    const first = answer[0]!;
    const wrong = first === "z" ? "x" : "z";

    fireEvent.keyDown(game, { key: wrong });
    expect(screen.getByTestId("answer")).toHaveAttribute("data-last-input", "incorrect");
    expect(screen.getByTestId("answer").querySelectorAll("[data-state=typed]")).toHaveLength(0);

    fireEvent.keyDown(game, { key: first });
    expect(screen.getByTestId("answer")).toHaveAttribute("data-last-input", "correct");
    expect(screen.getByTestId("answer").querySelectorAll("[data-state=typed]")).toHaveLength(1);
  });

  it("moves to the next question when the answer is completed (AC-05)", async () => {
    const clock = createClock();
    renderGame(clock);
    await startPlaying(clock);
    const game = screen.getByTestId("game");
    const firstId = screen.getByTestId("typing-input").getAttribute("data-question-id");
    const answer = screen
      .getByTestId("answer")
      .getAttribute("aria-label")!
      .replace("入力対象: ", "");
    for (const ch of answer) fireEvent.keyDown(game, { key: ch });
    expect(screen.getByTestId("typing-input").getAttribute("data-question-id")).not.toBe(firstId);
    expect(screen.getByTestId("combo-value")).toHaveTextContent("1");
    expect(screen.getByTestId("hud-score")).toHaveTextContent("130");
  });

  it("pauses with Esc and resumes with Esc (AC-15)", async () => {
    const clock = createClock();
    renderGame(clock);
    await startPlaying(clock);
    const game = screen.getByTestId("game");
    fireEvent.keyDown(game, { key: "Escape" });
    expect(game).toHaveAttribute("data-state", "PAUSED");
    expect(screen.getByRole("dialog", { name: "一時停止" })).toBeInTheDocument();
    await frame(clock, 10_000);
    expect(screen.getByTestId("hud-time")).toHaveTextContent("01:30");
    fireEvent.keyDown(game, { key: "Escape" });
    expect(game).toHaveAttribute("data-state", "PLAYING");
  });

  it("skips with Ctrl+Enter and resets the combo (AC-07)", async () => {
    const clock = createClock();
    renderGame(clock);
    await startPlaying(clock);
    const game = screen.getByTestId("game");
    const answer = screen
      .getByTestId("answer")
      .getAttribute("aria-label")!
      .replace("入力対象: ", "");
    for (const ch of answer) fireEvent.keyDown(game, { key: ch });
    expect(screen.getByTestId("combo-value")).toHaveTextContent("1");
    const id = screen.getByTestId("typing-input").getAttribute("data-question-id");
    fireEvent.keyDown(game, { key: "Enter", ctrlKey: true });
    expect(screen.getByTestId("combo-value")).toHaveTextContent("0");
    expect(screen.getByTestId("typing-input").getAttribute("data-question-id")).not.toBe(id);
  });

  it("pauses automatically when the tab is hidden", async () => {
    const clock = createClock();
    renderGame(clock);
    await startPlaying(clock);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("game")).toHaveAttribute("data-state", "PAUSED");
  });

  it("finishes after 90 seconds, saves the session and navigates to Result (AC-02)", async () => {
    const clock = createClock();
    const { router, database } = renderGame(clock);
    await startPlaying(clock);
    const game = screen.getByTestId("game");
    const answer = screen
      .getByTestId("answer")
      .getAttribute("aria-label")!
      .replace("入力対象: ", "");
    for (const ch of answer) fireEvent.keyDown(game, { key: ch });
    await frame(clock, GAME_DURATION_MS);
    // 確定処理は非同期なので FINISHED → RESULT のどちらか
    expect(["FINISHED", "RESULT"]).toContain(screen.getByTestId("game").getAttribute("data-state"));
    await flushAsync();
    await flushAsync();
    expect(database.sessions).toHaveLength(1);
    expect(database.sessions[0]?.solved).toBe(1);
    expect(screen.getByTestId("game")).toHaveAttribute("data-state", "RESULT");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await flushAsync();
    expect(router.state.location.pathname).toBe(ROUTES.result);
    expect((router.state.location.state as { session: GameSession }).session.id).toBe("s-test");
  });
});
