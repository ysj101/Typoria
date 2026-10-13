import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProvider } from "../app/AppContext";
import { createMemoryStorage } from "../app/storage";
import { makeSession } from "../test/factories";
import type { GameSession, UserProgress } from "../types/game";
import { History } from "./History";

const today = new Date(2026, 9, 13, 20, 0, 0);

function renderHistory(sessions: GameSession[], progress: Partial<UserProgress> = {}) {
  render(
    <AppProvider storage={createMemoryStorage({ progress })}>
      <MemoryRouter>
        <History database={{ listSessions: async () => sessions }} now={() => today} />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe("History page (§4.4)", () => {
  it("renders with empty data", async () => {
    renderHistory([]);
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(await screen.findByText("まだ記録がありません。")).toBeInTheDocument();
    expect(screen.getByTestId("stat-total-sessions")).toHaveTextContent("0 回");
    expect(screen.getByTestId("last-7-days").children).toHaveLength(7);
    expect(screen.getByTestId("accuracy-easy")).toHaveTextContent("-");
    expect(screen.getByRole("link", { name: "ホームへ戻る" })).toHaveAttribute("href", "/");
  });

  it("shows summary, 7-day activity, accuracy and recent sessions", async () => {
    const sessions = [
      makeSession({
        id: "a",
        startedAt: new Date(2026, 9, 13, 9, 30).toISOString(),
        difficulty: "easy",
        score: 1500,
        solved: 9,
        skipped: 1,
        correctKeystrokes: 100,
      }),
      makeSession({
        id: "b",
        startedAt: new Date(2026, 9, 12, 21, 0).toISOString(),
        difficulty: "hard",
        score: 800,
        solved: 2,
        skipped: 2,
        correctKeystrokes: 10,
        incorrectKeystrokes: 10,
      }),
    ];
    renderHistory(sessions, {
      totalSessions: 2,
      totalXP: 120,
      bestScore: 1500,
      currentStreak: 2,
      longestStreak: 5,
    });
    expect(await screen.findByText("10/13 09:30")).toBeInTheDocument();
    expect(screen.getByTestId("stat-total-sessions")).toHaveTextContent("2 回");
    expect(screen.getByText("3分")).toBeInTheDocument();
    expect(screen.getByText("120 XP")).toBeInTheDocument();
    expect(screen.getByText("2 日")).toBeInTheDocument();
    expect(screen.getByText("5 日")).toBeInTheDocument();
    expect(screen.getByTestId("accuracy-easy")).toHaveTextContent("90%");
    expect(screen.getByTestId("accuracy-hard")).toHaveTextContent("50%");
    expect(screen.getByTestId("accuracy-normal")).toHaveTextContent("-");
    const played = screen.getByTestId("last-7-days").querySelectorAll('[data-played="true"]');
    expect(played).toHaveLength(2);
    expect(screen.getByText("10/12 21:00")).toBeInTheDocument();
    expect(screen.getByLabelText("星 4")).toHaveTextContent("★★★★☆");
    expect(screen.getByLabelText("星 1")).toHaveTextContent("★☆☆☆☆");
    expect(screen.queryByText("まだ記録がありません。")).not.toBeInTheDocument();
  });
});
