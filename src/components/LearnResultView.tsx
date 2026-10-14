import { useEffect } from "react";
import type { LearnRoundResult } from "../game/learnQuiz";

export interface LearnResultViewProps {
  result: LearnRoundResult;
  onAgain: () => void;
  onHome: () => void;
}

/** 学習ラウンドのリザルト。今日学んだ用語と、理解度クイズの正誤 */
export function LearnResultView({ result, onAgain, onHome }: LearnResultViewProps) {
  const quizzed = result.terms.find((term) => term.termId === result.quiz.termId);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        // ボタンにフォーカスがあるときは、そのボタンの click に任せる
        if (event.target instanceof Element && event.target.closest("button")) return;
        event.preventDefault();
        onAgain();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onHome();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAgain, onHome]);

  return (
    <main
      className="screen-scroll screen-center items-center gap-6 p-6 text-text"
      data-testid="learn-result"
    >
      <h1 className="text-2xl font-bold tracking-[0.3em] text-subtext">RESULT</h1>
      <section className="w-full max-w-lg" aria-labelledby="learn-result-terms-heading">
        <h2 id="learn-result-terms-heading" className="mb-3 text-center text-lg font-bold">
          今日学んだ用語
        </h2>
        <ul className="space-y-3" data-testid="learn-result-terms">
          {result.terms.map((term) => (
            <li
              key={term.termId}
              data-testid="learn-result-term"
              data-term-id={term.termId}
              className="rounded-2xl border border-subtext/40 px-4 py-3"
            >
              <p className="font-bold">{term.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-subtext">{term.summary}</p>
            </li>
          ))}
        </ul>
      </section>
      <p
        data-testid="learn-result-quiz"
        data-correct={result.quiz.correct ? "true" : "false"}
        data-term-id={result.quiz.termId}
        className={`text-lg font-bold ${result.quiz.correct ? "text-correct" : "text-incorrect"}`}
      >
        理解度クイズ{quizzed ? `（${quizzed.name}）` : ""}:{" "}
        {result.quiz.correct ? "正解" : "不正解"}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          autoFocus
          onClick={onAgain}
          className="rounded-full bg-perfect px-8 py-3 text-lg font-bold text-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
        >
          もう一度
        </button>
        <button
          type="button"
          onClick={onHome}
          className="rounded-full border border-subtext px-8 py-3 text-lg font-bold text-text focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
        >
          ホームへ
        </button>
      </div>
      <p className="text-xs text-subtext">Enter: もう一度 / Esc: ホームへ</p>
    </main>
  );
}
