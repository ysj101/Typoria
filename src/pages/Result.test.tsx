import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../app/navigation";
import { makeSession } from "../test/factories";
import { Result } from "./Result";

function renderResult(state?: unknown) {
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <h1>Home</h1> },
      { path: ROUTES.game, element: <h1>Game</h1> },
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
});
