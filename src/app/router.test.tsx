import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProvider } from "./AppContext";
import { useAppContext } from "./useAppContext";
import { createMemoryStorage } from "./storage";
import { createTestRouter } from "./router";
import { ROUTES } from "./navigation";
import type { GameSession } from "../types/game";

function renderAt(entries: Parameters<typeof createTestRouter>[0]) {
  const router = createTestRouter(entries);
  render(
    <AppProvider storage={createMemoryStorage()}>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  return router;
}

describe("routing (§4)", () => {
  it.each([
    [ROUTES.home, "Typoria"],
    [ROUTES.game, "Game"],
    [ROUTES.result, "Result"],
    [ROUTES.history, "History"],
    [ROUTES.settings, "Settings"],
  ])("renders %s", async (path, heading) => {
    renderAt([path]);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("navigates Home → Game with the PLAY button", async () => {
    const router = renderAt([ROUTES.home]);
    await userEvent.click(await screen.findByRole("button", { name: "PLAY" }));
    expect(router.state.location.pathname).toBe(ROUTES.game);
    expect(screen.getByRole("heading", { name: "Game" })).toBeInTheDocument();
  });

  it("passes the session to Result via route state", async () => {
    const session = { id: "s1", score: 1234 } as GameSession;
    renderAt([
      { pathname: ROUTES.result, state: { session, isNewRecord: true, missionRewards: [] } },
    ]);
    expect(await screen.findByTestId("result-score")).toHaveTextContent("1234");
  });
});

describe("AppProvider", () => {
  function Probe() {
    const { ready, settings, progress, updateSettings } = useAppContext();
    return (
      <div>
        <span data-testid="ready">{String(ready)}</span>
        <span data-testid="sfx">{String(settings.sfxEnabled)}</span>
        <span data-testid="xp">{progress.totalXP}</span>
        <button type="button" onClick={() => void updateSettings({ sfxEnabled: false })}>
          mute
        </button>
      </div>
    );
  }

  it("loads settings and progress from storage and persists updates", async () => {
    const storage = createMemoryStorage({ progress: { totalXP: 42 } });
    render(
      <AppProvider storage={storage}>
        <Probe />
      </AppProvider>,
    );
    expect(
      await screen.findByText("true", { selector: "[data-testid=ready]" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("xp")).toHaveTextContent("42");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "mute" }));
    });
    expect(screen.getByTestId("sfx")).toHaveTextContent("false");
    expect((await storage.getSettings()).sfxEnabled).toBe(false);
  });
});
