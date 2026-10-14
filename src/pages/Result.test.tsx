import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../app/navigation";
import type { LearnRoundResult } from "../game/learnQuiz";
import { makeSession } from "../test/factories";
import { Result } from "./Result";

function renderResult(state?: unknown) {
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <h1>Home</h1> },
      { path: ROUTES.game, element: <h1>Game</h1> },
      { path: ROUTES.learn, element: <h1>Learn</h1> },
      { path: ROUTES.result, element: <Result /> },
    ],
    { initialEntries: [{ pathname: ROUTES.result, state }] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("Result page", () => {
  it("redirects to home when there is no payload", async () => {
    const router = renderResult(undefined);
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(ROUTES.home);
  });

  it("renders the result view with the payload", async () => {
    renderResult({
      session: makeSession({ score: 500, solved: 3 }),
      isNewRecord: false,
      missionRewards: [],
      nextDifficulty: "normal",
      streak: 1,
    });
    expect(await screen.findByRole("button", { name: "PLAY AGAIN" })).toBeInTheDocument();
    expect(screen.getByTestId("result-score")).toHaveTextContent("500");
  });

  it("renders the learn result with today's terms and the quiz", async () => {
    const state: LearnRoundResult = {
      terms: [{ termId: "ai-001", name: "機械学習", summary: "機械学習は基礎です。" }],
      quiz: { termId: "ai-001", correct: false, answeredAt: "2026-10-14T09:00:00.000Z" },
    };
    const router = renderResult(state);
    expect(await screen.findByRole("heading", { name: "今日学んだ用語" })).toBeInTheDocument();
    expect(screen.getByTestId("learn-result-quiz")).toHaveTextContent("不正解");
    await userEvent.click(screen.getByRole("button", { name: "もう一度" }));
    expect(router.state.location.pathname).toBe(ROUTES.learn);
  });
});
