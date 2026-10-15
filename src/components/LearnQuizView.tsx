import { useEffect, useRef } from "react";
import type { LearnQuizState, QuizChoiceIndex } from "../game/learnQuiz";

export interface LearnQuizViewProps {
  quiz: LearnQuizState;
  onAnswer: (sourceIndex: QuizChoiceIndex) => void;
  onResult: () => void;
}

/**
 * 理解度クイズの 4 択と、回答後の正誤・正解・解説。
 * 正誤判定は表示順ではなく、選択肢の元添字で行う。
 */
export function LearnQuizView({ quiz, onAnswer, onResult }: LearnQuizViewProps) {
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const resultButtonRef = useRef<HTMLButtonElement>(null);
  const answered = quiz.phase === "feedback";
  const correctText =
    quiz.question.choices.find((choice) => choice.sourceIndex === quiz.question.answerSourceIndex)
      ?.text ?? "";

  useEffect(() => {
    if (answered) resultButtonRef.current?.focus();
    else firstChoiceRef.current?.focus();
  }, [answered]);

  return (
    <section
      className="learn-quiz"
      data-testid="learn-quiz"
      data-term-id={quiz.question.termId}
      data-quiz-phase={quiz.phase}
      aria-labelledby="learn-quiz-question"
    >
      <p className="learn-kicker text-subtext" data-testid="learn-quiz-term">
        {quiz.question.termName}
      </p>
      <h2
        id="learn-quiz-question"
        className="learn-quiz__question"
        data-testid="learn-quiz-question"
      >
        {quiz.question.question}
      </h2>
      <ul className="learn-quiz__choices" aria-label="選択肢">
        {quiz.question.choices.map((choice, index) => {
          const isCorrectChoice = choice.sourceIndex === quiz.question.answerSourceIndex;
          const selected = choice.sourceIndex === quiz.selectedSourceIndex;
          return (
            <li key={choice.sourceIndex}>
              <button
                ref={index === 0 ? firstChoiceRef : undefined}
                type="button"
                className="learn-quiz__choice"
                data-testid="learn-quiz-choice"
                data-source-index={choice.sourceIndex}
                data-selected={selected ? "true" : "false"}
                data-correct-choice={answered && isCorrectChoice ? "true" : "false"}
                aria-disabled={answered || undefined}
                tabIndex={answered ? -1 : 0}
                onClick={() => {
                  if (answered) return;
                  onAnswer(choice.sourceIndex);
                }}
              >
                {choice.text}
                {answered && isCorrectChoice ? (
                  <span className="learn-quiz__mark">（正解）</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && quiz.result && (
        <div
          role="status"
          className="learn-quiz__feedback"
          data-testid="learn-quiz-feedback"
          data-correct={quiz.result.correct ? "true" : "false"}
        >
          <p
            className={`learn-quiz__judgment ${quiz.result.correct ? "text-correct" : "text-incorrect"}`}
            data-testid="learn-quiz-judgment"
          >
            {quiz.result.correct ? "正解" : "不正解"}
          </p>
          <p>
            正解: <span data-testid="learn-quiz-correct-answer">{correctText}</span>
          </p>
          <p data-testid="learn-quiz-explanation">{quiz.question.explanation}</p>
        </div>
      )}
      {answered && (
        <button
          ref={resultButtonRef}
          type="button"
          onClick={onResult}
          className="learn-quiz__result rounded-full bg-perfect px-8 py-3 font-bold text-bg focus-visible:ring-4 focus-visible:ring-fever"
        >
          結果へ
        </button>
      )}
    </section>
  );
}
