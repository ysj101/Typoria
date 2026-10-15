import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LearnRoundResult } from "../game/learnQuiz";
import { LearnResultView } from "./LearnResultView";

function result(correct: boolean): LearnRoundResult {
  return {
    terms: [
      { termId: "ai-001", name: "機械学習", summary: "機械学習は基礎です。" },
      { termId: "cloud-001", name: "SaaS", summary: "SaaSは基礎です。" },
    ],
    quiz: {
      termId: "ai-001",
      correct,
      answeredAt: "2026-10-14T09:00:00.000Z",
    },
  };
}

describe("LearnResultView", () => {
  it("shows today's terms and a correct quiz", async () => {
    const onAgain = vi.fn();
    const onHome = vi.fn();
    render(<LearnResultView result={result(true)} onAgain={onAgain} onHome={onHome} />);

    expect(screen.getByRole("heading", { name: "今日学んだ用語" })).toBeInTheDocument();
    const terms = screen.getAllByTestId("learn-result-term");
    expect(terms[0]).toHaveTextContent("機械学習");
    expect(terms[0]).toHaveTextContent("機械学習は基礎です。");
    expect(terms[1]).toHaveTextContent("SaaS");
    expect(screen.getByTestId("learn-result-quiz")).toHaveAttribute("data-correct", "true");
    expect(screen.getByTestId("learn-result-quiz")).toHaveTextContent(
      "理解度クイズ（機械学習）: 正解",
    );

    await userEvent.click(screen.getByRole("button", { name: "もう一度" }));
    expect(onAgain).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "ホームへ" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("shows an incorrect quiz and leaves with the keyboard", async () => {
    const onAgain = vi.fn();
    const onHome = vi.fn();
    render(<LearnResultView result={result(false)} onAgain={onAgain} onHome={onHome} />);

    expect(screen.getByTestId("learn-result-quiz")).toHaveAttribute("data-correct", "false");
    expect(screen.getByTestId("learn-result-quiz")).toHaveTextContent("不正解");

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onAgain).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
