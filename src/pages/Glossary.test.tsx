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

function renderGlossary(progress: TermProgress[] = []) {
  const router = createTestRouter([ROUTES.glossary]);
  render(
    <AppProvider storage={createMemoryStorage({ termProgress: progress })}>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  return router;
}

describe("Glossary", () => {
  it("lists terms by category with their study status", async () => {
    const mastered = TERMS.find((term) => term.category === "ai");
    const learning = TERMS.find((term) => term.category === "web");
    if (!mastered || !learning) throw new Error("expected sample terms");
    renderGlossary([
      {
        termId: mastered.id,
        seenCount: 2,
        quizCorrect: 1,
        quizIncorrect: 0,
        lastStudiedAt: "2026-10-14T09:00:00.000Z",
      },
      {
        termId: learning.id,
        seenCount: 1,
        quizCorrect: 0,
        quizIncorrect: 0,
        lastStudiedAt: "2026-10-14T09:00:00.000Z",
      },
    ]);

    expect(await screen.findByRole("heading", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Web" })).toBeInTheDocument();
    const masteredButton = screen.getByRole("button", { name: new RegExp(mastered.name) });
    const learningButton = screen.getByRole("button", { name: new RegExp(learning.name) });
    await waitFor(() => {
      expect(masteredButton).toHaveAttribute("data-status", "mastered");
      expect(learningButton).toHaveAttribute("data-status", "learning");
    });
    expect(masteredButton).toHaveTextContent("習得");
    expect(learningButton).toHaveTextContent("学習中");
    const unseen = TERMS.find((term) => term.category === "dev");
    if (!unseen) throw new Error("expected an unseen term");
    expect(screen.getByRole("button", { name: new RegExp(`^${unseen.name}`) })).toHaveTextContent(
      "未学習",
    );
  });

  it("shows the explanation when a term is tapped", async () => {
    const term = TERMS[0];
    if (!term) throw new Error("expected a term");
    renderGlossary();
    const button = await screen.findByRole("button", { name: new RegExp(term.name) });
    expect(screen.queryByTestId("glossary-explanation")).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(screen.getByTestId("glossary-explanation")).toHaveTextContent(term.explanation);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(button);
    expect(screen.queryByTestId("glossary-explanation")).not.toBeInTheDocument();
  });
});
