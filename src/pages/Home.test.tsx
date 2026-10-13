import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AppProvider } from "../app/AppContext";
import { ROUTES } from "../app/navigation";
import { createTestRouter } from "../app/router";
import { createMemoryStorage, type AppStorage } from "../app/storage";
import { localDateKey, missionsForDate } from "../game/habit";

const unlock = vi.fn(async () => {});
vi.mock("../hooks/useAudio", () => ({
  getSharedAudioEngine: () => ({ unlock }),
}));

function renderHome(storage: AppStorage = createMemoryStorage()) {
  const router = createTestRouter([ROUTES.home]);
  render(
    <AppProvider storage={storage}>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  return router;
}

describe("Home (§4.1)", () => {
  it("renders without any saved progress", async () => {
    renderHome();
    expect(await screen.findByRole("heading", { name: "Typoria" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PLAY" })).toBeInTheDocument();
    expect(screen.getByTestId("home-xp")).toHaveTextContent("0 XP");
    expect(screen.getByTestId("home-difficulty")).toHaveTextContent("Easy");
    expect(screen.getByTestId("home-today")).toHaveTextContent("未プレイ");
    expect(screen.getByRole("link", { name: "学習履歴" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
  });

  it("shows progress values", async () => {
    const today = localDateKey(new Date());
    renderHome(
      createMemoryStorage({
        progress: {
          totalXP: 320,
          bestScore: 4500,
          currentStreak: 3,
          currentDifficulty: "hard",
          lastPlayedDate: today,
        },
      }),
    );
    expect(await screen.findByText("320 XP")).toBeInTheDocument();
    expect(screen.getByTestId("home-best")).toHaveTextContent("4500");
    expect(screen.getByTestId("home-streak")).toHaveTextContent("3 日");
    expect(screen.getByTestId("home-difficulty")).toHaveTextContent("Hard");
    expect(screen.getByTestId("home-today")).toHaveTextContent("プレイ済み");
  });

  it("uses the fixed difficulty from settings", async () => {
    renderHome(
      createMemoryStorage({
        settings: { difficultyMode: "normal" },
        progress: { currentDifficulty: "hard" },
      }),
    );
    expect(await screen.findByText("Normal")).toBeInTheDocument();
  });

  it("shows today's missions with progress", async () => {
    const today = localDateKey(new Date());
    const stored = missionsForDate(today);
    stored.missions[0] = { ...stored.missions[0], current: 1, completed: true, rewarded: true };
    stored.missions[1] = { ...stored.missions[1], current: 4 };
    const storage: AppStorage = { ...createMemoryStorage(), getMission: async () => stored };
    renderHome(storage);
    const play = await screen.findByTestId("mission-play_once");
    expect(play).toHaveAttribute("data-completed", "true");
    expect(play).toHaveTextContent("1/1");
    expect(screen.getByTestId("mission-solve_10")).toHaveTextContent("4/10");
    expect(screen.getByTestId("mission-perfect_5")).toHaveTextContent("0/5");
  });

  it("ignores a stored mission from another day", async () => {
    const stored = missionsForDate("2000-01-01");
    stored.missions[1] = { ...stored.missions[1], current: 9 };
    renderHome({ ...createMemoryStorage(), getMission: async () => stored });
    await screen.findByTestId("mission-solve_10");
    expect(screen.getByTestId("mission-solve_10")).toHaveTextContent("0/10");
  });

  it("starts the game with Enter on the autofocused PLAY button", async () => {
    const router = renderHome();
    await screen.findByRole("button", { name: "PLAY" });
    expect(screen.getByRole("button", { name: "PLAY" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(router.state.location.pathname).toBe(ROUTES.game);
  });

  it("unlocks the audio engine when PLAY is pressed (§9.2)", async () => {
    unlock.mockClear();
    renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "PLAY" }));
    expect(unlock).toHaveBeenCalledTimes(1);
  });
});
