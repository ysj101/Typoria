import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Learn } from "./Learn";
import type { Term, TermCategory } from "../types/term";

function term(id: string, typingText: string, name: string): Term {
  const category = id.slice(0, id.lastIndexOf("-")) as TermCategory;
  return {
    id,
    category,
    level: 1,
    name,
    explanation: `${name}の解説。画面の上に残る文章です。`,
    typingText,
    quiz: {
      question: "質問",
      choices: ["A", "B", "C", "D"],
      answerIndex: 0,
      explanation: "解説",
    },
  };
}

const TERMS = [
  term("ai-001", "cat", "機械学習"),
  term("cloud-001", "saas", "SaaS"),
  term("web-001", "html", "HTML"),
];

function renderLearn(terms: readonly Term[] = TERMS) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <h1>Typoria</h1> },
      { path: "/learn", element: <Learn terms={terms} /> },
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

  it("accepts the hidden input and finishes the round with a quiz handoff", async () => {
    const router = renderLearn();
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
    const placeholder = screen.getByTestId("learn-quiz-placeholder");
    expect(placeholder).toHaveAttribute("data-next-phase", "quiz");
    expect(placeholder).toHaveAttribute("data-term-ids", "ai-001 cloud-001 web-001");
    expect(placeholder).toHaveTextContent("理解度クイズは次の更新で始まります。");

    await userEvent.click(screen.getByRole("button", { name: "ホームへ戻る" }));
    expect(router.state.location.pathname).toBe("/");
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
