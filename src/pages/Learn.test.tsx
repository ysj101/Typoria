import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Result } from "./Result";
import { Learn } from "./Learn";
import { makeTerm } from "../test/factories";
import type { Term } from "../types/term";

const term = (id: string, typingText: string, name: string) =>
  makeTerm(id, {
    typingText,
    name,
    quiz: {
      question: `${name}の質問`,
      choices: ["A", "B", "C", "D"],
      answerIndex: 0,
      explanation: `${name}のクイズ解説`,
    },
  });

const TERMS = [
  term("ai-001", "cat", "機械学習"),
  term("cloud-001", "saas", "SaaS"),
  term("web-001", "html", "HTML"),
];

function renderLearn(
  terms: readonly Term[] = TERMS,
  options?: { rng?: () => number; now?: () => Date },
) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <h1>Typoria</h1> },
      {
        path: "/learn",
        element: <Learn terms={terms} rng={options?.rng} now={options?.now} />,
      },
      { path: "/result", element: <Result /> },
    ],
    { initialEntries: ["/learn"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function typeOnLearn(text: string) {
  const learn = screen.getByTestId("learn");
  for (const ch of text) fireEvent.keyDown(learn, { key: ch });
}

async function finishRound() {
  for (const word of ["cat", "saas", "html"]) {
    await userEvent.click(screen.getByRole("button", { name: "打つ" }));
    typeOnLearn(word);
  }
}

const QUIZ_NOW = () => new Date("2026-10-14T09:00:00.000Z");

describe("Learn page", () => {
  const previousViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");

  afterEach(() => {
    if (previousViewport) Object.defineProperty(window, "visualViewport", previousViewport);
    else delete (window as { visualViewport?: VisualViewport }).visualViewport;
    document.documentElement.style.removeProperty("--vvh");
    document.documentElement.style.removeProperty("--vv-top");
  });

  it("shows the term, then types it, and keeps the explanation on screen", async () => {
    renderLearn();
    expect(screen.getByRole("heading", { name: "IT基礎用語" })).toBeInTheDocument();
    expect(screen.getByTestId("learn")).toHaveAttribute("data-phase", "reading");
    expect(screen.getByTestId("learn-name")).toHaveTextContent("機械学習");
    expect(screen.getByTestId("learn-category")).toHaveTextContent("AI");
    expect(screen.getByTestId("learn-progress")).toHaveTextContent("1 / 3");
    expect(screen.getByTestId("learn-explanation")).toHaveTextContent("機械学習の解説");
    expect(screen.queryByTestId("learn-answer")).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId("learn"), { key: "c" });
    expect(screen.getByTestId("learn")).toHaveAttribute("data-phase", "reading");

    await userEvent.click(screen.getByRole("button", { name: "打つ" }));
    expect(screen.getByTestId("learn")).toHaveAttribute("data-phase", "typing");
    expect(screen.getByTestId("learn-explanation")).toHaveTextContent("機械学習の解説");
    const input = screen.getByTestId("soft-keyboard-input");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-label", "解答を入力");
    expect(input).toHaveAttribute("inputmode", "text");
    const answer = screen.getByTestId("learn-answer");
    expect(answer).toHaveAttribute("aria-label", "入力対象: cat");

    fireEvent.keyDown(screen.getByTestId("learn"), { key: "x" });
    expect(answer).toHaveAttribute("data-last-input", "incorrect");
    expect(answer.querySelectorAll("[data-state=typed]")).toHaveLength(0);

    typeOnLearn("cat");
    expect(screen.getByTestId("learn")).toHaveAttribute("data-phase", "reading");
    expect(screen.getByTestId("learn-name")).toHaveTextContent("SaaS");
    expect(screen.getByTestId("learn-progress")).toHaveTextContent("2 / 3");
    expect(screen.queryByTestId("learn-answer")).not.toBeInTheDocument();
  });

  it("finishes the round, answers the quiz, and opens the learn result", async () => {
    const router = renderLearn(TERMS, { rng: () => 0, now: QUIZ_NOW });
    await userEvent.click(screen.getByRole("button", { name: "打つ" }));
    const input = screen.getByTestId("soft-keyboard-input");
    act(() => {
      for (const ch of "cat") {
        input.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: ch,
          }),
        );
      }
    });
    expect(input).toHaveValue("");
    expect(screen.getByTestId("learn-name")).toHaveTextContent("SaaS");

    await userEvent.click(screen.getByRole("button", { name: "打つ" }));
    typeOnLearn("saas");
    await userEvent.click(screen.getByRole("button", { name: "打つ" }));
    typeOnLearn("html");

    expect(screen.getByTestId("learn")).toHaveAttribute("data-phase", "roundEnd");
    expect(screen.getByTestId("learn-learned")).toHaveTextContent("機械学習");
    expect(screen.getByTestId("learn-learned")).toHaveTextContent("HTML");
    expect(screen.queryByTestId("learn-explanation")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "理解度クイズへ" }));
    expect(screen.getByTestId("learn")).toHaveAttribute("data-phase", "quiz");
    expect(screen.getByTestId("learn-quiz-question")).toHaveTextContent("機械学習の質問");
    const choices = screen.getAllByTestId("learn-quiz-choice");
    expect(choices.map((choice) => choice.getAttribute("data-source-index"))).toEqual([
      "1",
      "2",
      "3",
      "0",
    ]);

    await userEvent.click(choices[3]!);
    expect(screen.getByTestId("learn-quiz-feedback")).toHaveAttribute("data-correct", "true");
    expect(screen.getByTestId("learn-quiz-judgment")).toHaveTextContent("正解");
    expect(screen.getByTestId("learn-quiz-correct-answer")).toHaveTextContent("A");
    expect(screen.getByTestId("learn-quiz-explanation")).toHaveTextContent("機械学習のクイズ解説");

    await userEvent.click(screen.getByRole("button", { name: "結果へ" }));
    expect(router.state.location.pathname).toBe("/result");
    expect(router.state.location.state).toEqual({
      terms: [
        { termId: "ai-001", name: "機械学習", summary: "機械学習の解説。" },
        { termId: "cloud-001", name: "SaaS", summary: "SaaSの解説。" },
        { termId: "web-001", name: "HTML", summary: "HTMLの解説。" },
      ],
      quiz: {
        termId: "ai-001",
        correct: true,
        answeredAt: "2026-10-14T09:00:00.000Z",
      },
    });
    expect(screen.getByRole("heading", { name: "今日学んだ用語" })).toBeInTheDocument();
    expect(screen.getByTestId("learn-result-quiz")).toHaveTextContent("正解");
    expect(screen.getByTestId("learn-result")).toHaveTextContent("機械学習の解説。");

    await userEvent.click(screen.getByRole("button", { name: "ホームへ" }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("shows an incorrect quiz from the keyboard and keeps that result", async () => {
    const router = renderLearn(TERMS, { rng: () => 0, now: QUIZ_NOW });
    await finishRound();
    await userEvent.click(screen.getByRole("button", { name: "理解度クイズへ" }));
    expect(screen.getAllByTestId("learn-quiz-choice")[0]).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("learn-quiz-feedback")).toHaveAttribute("data-correct", "false");
    expect(screen.getByTestId("learn-quiz-judgment")).toHaveTextContent("不正解");
    expect(screen.getByTestId("learn-quiz-correct-answer")).toHaveTextContent("A");
    expect(screen.getByTestId("learn-quiz-explanation")).toHaveTextContent("機械学習のクイズ解説");

    await userEvent.click(screen.getByRole("button", { name: "結果へ" }));
    expect(router.state.location.state).toMatchObject({
      quiz: { termId: "ai-001", correct: false, answeredAt: "2026-10-14T09:00:00.000Z" },
    });
    expect(screen.getByTestId("learn-result-quiz")).toHaveAttribute("data-correct", "false");
    expect(screen.getByTestId("learn-result-quiz")).toHaveTextContent("不正解");
  });

  it("returns home from the quit button during reading", async () => {
    const router = renderLearn();
    await userEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("publishes a short visual viewport onto the learn screen", () => {
    const listeners = new Map<string, () => void>();
    const vv = {
      height: 320,
      offsetTop: 18,
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });

    renderLearn();
    expect(screen.getByTestId("learn")).toHaveAttribute("data-compact", "true");
    expect(screen.getByTestId("learn")).toHaveClass("learn-screen--compact");
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("320px");
    expect(document.documentElement.style.getPropertyValue("--vv-top")).toBe("18px");
  });
});
