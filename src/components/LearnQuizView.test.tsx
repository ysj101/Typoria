import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { answerLearnQuiz, createLearnQuiz } from "../game/learnQuiz";
import { makeTerm } from "../test/factories";
import { LearnQuizView } from "./LearnQuizView";

const term = (id: string, name: string) =>
  makeTerm(id, {
    name,
    explanation: `${name}は基礎です。補足です。`,
    typingText: "term",
    quiz: {
      question: `${name}の質問`,
      choices: ["A", "B", "C", "D"],
      answerIndex: 0,
      explanation: `${name}のクイズ解説`,
    },
  });

const TERMS = [term("ai-001", "機械学習"), term("cloud-001", "SaaS"), term("web-001", "HTML")];
const NOW = () => new Date("2026-10-14T09:00:00.000Z");

function asking() {
  return createLearnQuiz(TERMS, { rng: () => 0 });
}

describe("LearnQuizView", () => {
  it("shuffles choices and reports the source index, not the display position", async () => {
    const onAnswer = vi.fn();
    const quiz = asking();
    render(<LearnQuizView quiz={quiz} onAnswer={onAnswer} onResult={vi.fn()} />);

    expect(screen.getByTestId("learn-quiz-question")).toHaveTextContent("機械学習の質問");
    const choices = screen.getAllByTestId("learn-quiz-choice");
    expect(choices.map((choice) => choice.getAttribute("data-source-index"))).toEqual([
      "1",
      "2",
      "3",
      "0",
    ]);
    expect(choices.map((choice) => choice.textContent)).toEqual(["B", "C", "D", "A"]);
    expect(choices[0]).toHaveFocus();
    expect(screen.queryByTestId("learn-quiz-feedback")).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it("shows an incorrect answer, the correct choice, and the explanation", () => {
    const quiz = answerLearnQuiz(asking(), 1, NOW);
    render(<LearnQuizView quiz={quiz} onAnswer={vi.fn()} onResult={vi.fn()} />);

    const feedback = screen.getByTestId("learn-quiz-feedback");
    expect(feedback).toHaveAttribute("data-correct", "false");
    expect(screen.getByTestId("learn-quiz-judgment")).toHaveTextContent("不正解");
    expect(screen.getByTestId("learn-quiz-correct-answer")).toHaveTextContent("A");
    expect(screen.getByTestId("learn-quiz-explanation")).toHaveTextContent("機械学習のクイズ解説");
    expect(screen.getByRole("button", { name: "A（正解）" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "結果へ" })).toHaveFocus();
  });

  it("shows a correct answer with the explanation", async () => {
    const onResult = vi.fn();
    const quiz = answerLearnQuiz(asking(), 0, NOW);
    render(<LearnQuizView quiz={quiz} onAnswer={vi.fn()} onResult={onResult} />);

    expect(screen.getByTestId("learn-quiz-feedback")).toHaveAttribute("data-correct", "true");
    expect(screen.getByTestId("learn-quiz-judgment")).toHaveTextContent("正解");
    expect(screen.getByTestId("learn-quiz-correct-answer")).toHaveTextContent("A");
    expect(screen.getByTestId("learn-quiz-explanation")).toHaveTextContent("機械学習のクイズ解説");

    await userEvent.keyboard("{Enter}");
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("does not answer again from a choice after feedback", async () => {
    const onAnswer = vi.fn();
    const quiz = answerLearnQuiz(asking(), 0, NOW);
    render(<LearnQuizView quiz={quiz} onAnswer={onAnswer} onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
