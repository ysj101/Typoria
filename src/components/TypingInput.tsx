import { memo } from "react";
import type { TypingState } from "../game/typing";
import type { Question } from "../types/game";

export interface TypingInputProps {
  question: Question;
  typing: TypingState;
  /**
   * 入力ごとに変わるキー。直前に入力した文字のアニメーション（拡大 80ms / 揺れ 120ms）を再始動する。
   * 省略時はアニメーションしない
   */
  charAnimKey?: number;
  /** ゴースト表示（クリア直後のフェードアウト用）。true のとき aria-hidden で装飾のみ */
  ghost?: boolean;
}

const BLANK = "_____";

/**
 * 問題表示（docs/spec.md §4.2, §5.2, §9.1）。
 * 日本語・英文・入力対象を中央に大きく表示し、入力済 / 未入力 / 誤入力を色分けする。
 */
export const TypingInput = memo(function TypingInput({
  question,
  typing,
  charAnimKey,
  ghost = false,
}: TypingInputProps) {
  const blankIndex = question.type === "fill_blank" ? question.english.indexOf(BLANK) : -1;
  const before = blankIndex >= 0 ? question.english.slice(0, blankIndex) : null;
  const after = blankIndex >= 0 ? question.english.slice(blankIndex + BLANK.length) : null;
  const animate = charAnimKey !== undefined && !ghost;

  return (
    <section
      className={`flex w-full flex-col items-center gap-6 text-center ${ghost ? "fx-ghost pointer-events-none absolute inset-0" : ""}`}
      aria-label={ghost ? undefined : "問題"}
      aria-hidden={ghost || undefined}
      data-testid={ghost ? "typing-ghost" : "typing-input"}
      data-question-id={question.id}
    >
      <p
        className="text-xl text-subtext sm:text-2xl"
        data-testid={ghost ? undefined : "question-japanese"}
      >
        {question.japanese}
      </p>
      {question.type === "fill_blank" && (
        <p
          className="typing-text max-w-full break-words text-2xl text-text sm:text-3xl"
          data-testid={ghost ? undefined : "question-english"}
        >
          {before}
          <span className="rounded border-b-2 border-subtext px-1 text-perfect">
            {typing.answer}
          </span>
          {after}
        </p>
      )}
      <p
        className="typing-text max-w-full break-words text-4xl font-bold sm:text-6xl"
        data-testid={ghost ? undefined : "answer"}
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
                  : "text-subtext";
          // 直前に入力した文字: 正しければ typed の末尾、誤りなら current 位置
          const justTyped =
            animate &&
            ((typing.lastInput === "correct" && i === typing.cursor - 1) ||
              (typing.lastInput === "incorrect" && i === typing.cursor));
          const anim = justTyped ? (typing.lastInput === "correct" ? "pop" : "shake") : undefined;
          return (
            <span
              key={justTyped ? `${i}-${charAnimKey}` : i}
              data-state={state}
              data-animate={anim}
              className={`inline-block ${color}`}
            >
              {ch === " " ? " " : ch}
            </span>
          );
        })}
      </p>
      {question.hint && <p className="text-sm text-subtext">{question.hint}</p>}
    </section>
  );
});
