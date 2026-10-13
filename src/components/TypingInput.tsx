import { memo } from "react";
import type { TypingState } from "../game/typing";
import type { Question } from "../types/game";

export interface TypingInputProps {
  question: Question;
  typing: TypingState;
}

const BLANK = "_____";

/**
 * 問題表示（docs/spec.md §4.2, §5.2）。
 * 日本語・英文・入力対象を中央に大きく表示し、入力済 / 未入力 / 誤入力を色分けする。
 */
export const TypingInput = memo(function TypingInput({ question, typing }: TypingInputProps) {
  const blankIndex = question.type === "fill_blank" ? question.english.indexOf(BLANK) : -1;
  const before = blankIndex >= 0 ? question.english.slice(0, blankIndex) : null;
  const after = blankIndex >= 0 ? question.english.slice(blankIndex + BLANK.length) : null;

  return (
    <section
      className="flex w-full flex-col items-center gap-6 text-center"
      aria-label="問題"
      data-testid="typing-input"
      data-question-id={question.id}
    >
      <p className="text-xl text-subtext sm:text-2xl" data-testid="question-japanese">
        {question.japanese}
      </p>
      {question.type === "fill_blank" && (
        <p className="typing-text text-2xl text-text/80 sm:text-3xl" data-testid="question-english">
          {before}
          <span className="rounded border-b-2 border-subtext px-1 text-perfect">
            {typing.answer}
          </span>
          {after}
        </p>
      )}
      <p
        className="typing-text text-4xl font-bold sm:text-6xl"
        data-testid="answer"
        data-last-input={typing.lastInput ?? "none"}
        aria-label={`入力対象: ${typing.answer}`}
      >
        {Array.from(typing.answer).map((ch, i) => {
          const state =
            i < typing.cursor
              ? "typed"
              : i === typing.cursor
                ? typing.lastInput === "incorrect"
                  ? "incorrect"
                  : "current"
                : "pending";
          const color =
            state === "typed"
              ? "text-correct"
              : state === "incorrect"
                ? "text-incorrect"
                : state === "current"
                  ? "text-text underline decoration-perfect underline-offset-8"
                  : "text-subtext/60";
          return (
            <span key={i} data-state={state} className={`inline-block ${color}`}>
              {ch === " " ? " " : ch}
            </span>
          );
        })}
      </p>
      {question.hint && <p className="text-sm text-subtext">{question.hint}</p>}
    </section>
  );
});
