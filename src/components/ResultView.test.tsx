import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession } from "../test/factories";
import { ResultView, RESULT_TIMELINE } from "./ResultView";

const mockReduced = vi.hoisted(() => ({ value: false }));
vi.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReduced.value,
}));

const session = makeSession({
  score: 1234,
  maxCombo: 12,
  solved: 10,
  skipped: 1,
  perfectSolved: 4,
  correctKeystrokes: 95,
  incorrectKeystrokes: 5,
  xpEarned: 78,
});

function litStars() {
  return screen.getAllByTestId("star").filter((s) => s.dataset.lit === "true");
}

function renderView(overrides: Partial<Parameters<typeof ResultView>[0]> = {}) {
  const onPlayAgain = vi.fn();
  const onBackHome = vi.fn();
  const utils = render(
    <ResultView
      session={session}
      isNewRecord
      missionRewards={[]}
      onPlayAgain={onPlayAgain}
      onBackHome={onBackHome}
      {...overrides}
    />,
  );
  return { onPlayAgain, onBackHome, ...utils };
}

describe("ResultView (§4.3)", () => {
  beforeEach(() => {
    mockReduced.value = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows accuracy, best combo, solved and XP (AC-09)", () => {
    renderView();
    act(() => vi.advanceTimersByTime(RESULT_TIMELINE.total));
    // 10 / (10 + 1) = 90.9% → 91%
    expect(screen.getByTestId("accuracy")).toHaveTextContent("91%");
    expect(screen.getByTestId("best-combo")).toHaveTextContent("12");
    expect(screen.getByTestId("solved")).toHaveTextContent("10");
    expect(screen.getByTestId("xp-earned")).toHaveTextContent("+78");
    expect(screen.getByTestId("result-score")).toHaveTextContent("1234");
  });

  it("animates stars and score, finishing within 2 seconds", () => {
    renderView();
    expect(screen.getByTestId("score-display")).toHaveTextContent("0");
    expect(litStars()).toHaveLength(0);
    expect(screen.queryByTestId("new-record")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(RESULT_TIMELINE.starInterval * 2 + 1));
    expect(litStars()).toHaveLength(2);

    act(() => vi.advanceTimersByTime(2000 - RESULT_TIMELINE.starInterval * 2 - 1));
    expect(screen.getByTestId("score-display")).toHaveTextContent("1,234");
    expect(screen.getByTestId("new-record")).toBeInTheDocument();
    expect(screen.getByTestId("xp-earned")).toHaveTextContent("+78");
    // problem 0.909 * 0.6 + typing 0.95 * 0.4 = 0.925 → 4 stars
    expect(litStars()).toHaveLength(4);
    expect(screen.getByTestId("result-view")).toHaveAttribute("data-animation-done", "true");
  });

  it("shows final values immediately with reduced motion", () => {
    mockReduced.value = true;
    renderView();
    expect(screen.getByTestId("score-display")).toHaveTextContent("1,234");
    expect(screen.getByTestId("new-record")).toBeInTheDocument();
    expect(litStars()).toHaveLength(4);
    expect(screen.getByTestId("result-view")).toHaveAttribute("data-animation-done", "true");
  });

  it("does not show NEW RECORD when isNewRecord is false", () => {
    mockReduced.value = true;
    renderView({ isNewRecord: false });
    expect(screen.queryByTestId("new-record")).not.toBeInTheDocument();
  });

  it("calls onPlayAgain on Enter even while animating (AC-18)", () => {
    const { onPlayAgain, onBackHome } = renderView();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it("calls callbacks from the buttons and focuses PLAY AGAIN", () => {
    const { onPlayAgain, onBackHome } = renderView();
    const play = screen.getByRole("button", { name: "PLAY AGAIN" });
    expect(play).toHaveFocus();
    fireEvent.click(play);
    fireEvent.click(screen.getByRole("button", { name: "BACK TO HOME" }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it("lists mission rewards and includes them in XP", () => {
    mockReduced.value = true;
    renderView({
      missionRewards: [
        { id: "play_once", rewardXP: 20 },
        { id: "solve_10", rewardXP: 30 },
      ],
      nextDifficulty: "hard",
      streak: 3,
    });
    const list = screen.getByTestId("mission-rewards");
    expect(list).toHaveTextContent("1 回プレイする");
    expect(list).toHaveTextContent("+20 XP");
    expect(list).toHaveTextContent("10 問クリアする");
    expect(list).toHaveTextContent("+30 XP");
    expect(screen.getByTestId("xp-earned")).toHaveTextContent("+128");
    expect(screen.getByTestId("next-difficulty")).toHaveTextContent("Hard");
    expect(screen.getByTestId("streak")).toHaveTextContent("3");
  });

  it("clears timers on unmount", () => {
    const { unmount } = renderView();
    unmount();
    expect(() => act(() => vi.advanceTimersByTime(3000))).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
