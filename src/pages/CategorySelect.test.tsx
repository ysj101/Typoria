import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProvider } from "../app/AppContext";
import { ROUTES } from "../app/navigation";
import { createTestRouter } from "../app/router";
import { createMemoryStorage } from "../app/storage";
import { TERMS } from "../data/terms";
import type { TermProgress } from "../types/term";

function renderAt(storage = createMemoryStorage()) {
  const router = createTestRouter([ROUTES.learn]);
  render(
    <AppProvider storage={storage}>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  return router;
}

describe("CategorySelect", () => {
  it("shows mastered counts and starts a round for the tapped category", async () => {
    const aiTotal = TERMS.filter((term) => term.category === "ai").length;
    const progress: TermProgress[] = [
      {
        termId: "ai-001",
        seenCount: 1,
        quizCorrect: 1,
        quizIncorrect: 0,
        lastStudiedAt: "2026-10-14T09:00:00.000Z",
      },
      {
        termId: "ai-002",
        seenCount: 1,
        quizCorrect: 0,
        quizIncorrect: 1,
        lastStudiedAt: "2026-10-14T09:00:00.000Z",
      },
    ];
    const router = renderAt(createMemoryStorage({ termProgress: progress }));
    await waitFor(() => {
      expect(screen.getByTestId("category-ai")).toHaveAttribute("data-mastered", "1");
    });
    const ai = screen.getByRole("button", { name: new RegExp(`習得 1 / 全 ${aiTotal} 語`) });
    expect(ai).toHaveAttribute("data-testid", "category-ai");
    expect(screen.getByTestId("category-web")).toHaveTextContent(/習得 0 \/ 全 \d+ 語/);

    await userEvent.click(ai);
    expect(router.state.location.pathname).toBe(ROUTES.learnRound);
    expect(router.state.location.state).toEqual({ mode: "category", category: "ai" });
    expect(await screen.findByTestId("learn-category")).toHaveTextContent("AI");
    expect(screen.getByTestId("learn")).toHaveAttribute(
      "data-term-id",
      expect.stringMatching(/^ai-/),
    );
  });

  it("starts an omakase round", async () => {
    const router = renderAt();
    await userEvent.click(await screen.findByRole("button", { name: /おまかせ/ }));
    expect(router.state.location.pathname).toBe(ROUTES.learnRound);
    expect(router.state.location.state).toEqual({ mode: "omakase" });
    expect(await screen.findByTestId("learn")).toHaveAttribute("data-phase", "reading");
  });

  it("opens the glossary", async () => {
    const router = renderAt();
    await userEvent.click(await screen.findByRole("link", { name: "用語帳" }));
    expect(router.state.location.pathname).toBe(ROUTES.glossary);
    expect(screen.getByRole("heading", { name: "用語帳" })).toBeInTheDocument();
  });
});
