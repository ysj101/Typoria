import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { useAppNavigate } from "../app/navigation";
import { selectTerms } from "../data/terms";
import {
  beginTyping,
  createLearnRound,
  currentTerm,
  inputLearnChar,
  requestQuiz,
  type LearnQuizTransition,
  type LearnRoundState,
} from "../game/learnRound";
import type { TypingState } from "../game/typing";
import { useKeyboard } from "../hooks/useKeyboard";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { TERM_CATEGORY_LABELS, type Term } from "../types/term";
import "./Learn.css";

export interface LearnProps {
  /** 未指定なら全カテゴリから既定の 3 語 */
  terms?: readonly Term[];
}

/** ボタン上のタップでは、ソフトキーボード用 input へフォーカスを移さない */
function isKeyboardChromeTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, a, textarea, select, [role='dialog']"))
  );
}

/**
 * 学習モード（#74）。
 * 1 ラウンドは「解説を読む → typingText を打つ」を既定 3 語くり返し、ラウンド終了で止める。
 * 理解度クイズ（#75）へは `requestQuiz` で渡す。この画面の先は仮の完了表示。
 */
export function Learn({ terms }: LearnProps) {
  const nav = useAppNavigate();
  const { compact } = useVisualViewport();
  const [round, setRound] = useState<LearnRoundState>(() => createInitialRound(terms));
  const [quiz, setQuiz] = useState<LearnQuizTransition | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const typingInputRef = useRef<HTMLInputElement>(null);
  const beginButtonRef = useRef<HTMLButtonElement>(null);
  const quizButtonRef = useRef<HTMLButtonElement>(null);

  const focusTypingInput = useCallback(() => {
    typingInputRef.current?.focus({ preventScroll: true });
  }, []);

  const onBeginTyping = useCallback(() => {
    setRound((current) => beginTyping(current));
    // iOS Chrome はユーザー操作の同期処理でしかソフトキーボードを出さない（#59）
    focusTypingInput();
  }, [focusTypingInput]);

  const onChar = useCallback((char: string) => {
    setRound((current) => inputLearnChar(current, char).state);
  }, []);

  useKeyboard({
    enabled: round.phase === "typing",
    onChar,
    target: containerRef,
    textInput: typingInputRef,
  });

  useEffect(() => {
    if (round.phase === "typing") return;
    if (document.activeElement === typingInputRef.current) {
      typingInputRef.current?.blur();
    }
  }, [round.phase]);

  useEffect(() => {
    if (round.phase === "reading") beginButtonRef.current?.focus();
    if (round.phase === "roundEnd") quizButtonRef.current?.focus();
  }, [round.phase, round.index]);

  const keyboardOpen = round.phase === "typing";
  const keepSoftKeyboard = useCallback(
    (event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
      if (!keyboardOpen || isKeyboardChromeTarget(event.target)) return;
      event.preventDefault();
      focusTypingInput();
    },
    [keyboardOpen, focusTypingInput],
  );

  const term = currentTerm(round);
  const onQuiz = () => {
    const next = requestQuiz(round);
    if (next) setQuiz(next);
  };

  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      aria-label="学習ラウンド"
      className={`learn-screen outline-none${compact ? " learn-screen--compact" : ""}`}
      data-testid="learn"
      data-phase={round.phase}
      data-compact={compact ? "true" : "false"}
      data-term-id={term?.id ?? ""}
      onMouseDown={keepSoftKeyboard}
      onTouchStart={keepSoftKeyboard}
      onContextMenu={(event) => event.preventDefault()}
    >
      <input
        ref={typingInputRef}
        type="text"
        tabIndex={-1}
        className="soft-keyboard-input"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="done"
        aria-label="解答を入力"
        data-testid="soft-keyboard-input"
        defaultValue=""
      />
      <div className="learn-screen__column">
        <header className="flex flex-col gap-1">
          <h1 className="learn-title text-subtext">IT基礎用語</h1>
          {term && (
            <>
              <p className="learn-kicker text-subtext">
                <span
                  data-testid="learn-progress"
                  aria-label={`用語 ${round.index + 1} / ${round.terms.length}`}
                >
                  {round.index + 1} / {round.terms.length}
                </span>
                <span data-testid="learn-category">{TERM_CATEGORY_LABELS[term.category]}</span>
              </p>
              <h2 className="learn-name" data-testid="learn-name">
                {term.name}
              </h2>
            </>
          )}
        </header>

        {term && (
          <p
            id="learn-explanation-text"
            className="learn-explanation text-text"
            data-testid="learn-explanation"
          >
            {term.explanation}
          </p>
        )}

        <div className="learn-stage">
          {round.phase === "reading" && term && (
            <button
              ref={beginButtonRef}
              type="button"
              onClick={onBeginTyping}
              onTouchEnd={onBeginTyping}
              className="rounded-full bg-perfect px-12 py-3 text-xl font-bold text-bg focus-visible:ring-4 focus-visible:ring-fever"
            >
              打つ
            </button>
          )}
          {round.phase === "typing" && round.typing && <LearnAnswer typing={round.typing} />}
          {round.phase === "roundEnd" && (
            <RoundEnd
              round={round}
              quiz={quiz}
              quizButtonRef={quizButtonRef}
              onQuiz={onQuiz}
              onHome={() => nav.toHome()}
            />
          )}
        </div>

        {round.phase !== "roundEnd" && (
          <footer className="learn-footer text-sm text-subtext">
            {keyboardOpen && (
              <button
                type="button"
                data-testid="learn-open-keyboard"
                onMouseDown={(event) => event.preventDefault()}
                onTouchStart={(event) => {
                  event.preventDefault();
                  focusTypingInput();
                }}
                onClick={focusTypingInput}
                className="rounded-full border border-subtext px-4 py-2 hover:border-text hover:text-text"
              >
                キーボードを開く
              </button>
            )}
            <button
              type="button"
              onClick={() => nav.toHome()}
              className="rounded-full border border-subtext px-4 py-2 hover:border-text hover:text-text"
            >
              やめる
            </button>
          </footer>
        )}
      </div>
    </section>
  );
}

function createInitialRound(terms: readonly Term[] | undefined): LearnRoundState {
  return createLearnRound(terms ?? selectTerms());
}

function LearnAnswer({ typing }: { typing: TypingState }) {
  return (
    <p
      className="typing-text learn-answer font-bold"
      data-testid="learn-answer"
      data-last-input={typing.lastInput ?? "none"}
      aria-label={`入力対象: ${typing.answer}`}
      aria-describedby="learn-explanation-text"
    >
      {Array.from(typing.answer).map((ch, index) => {
        const state =
          index < typing.cursor
            ? "typed"
            : index === typing.cursor
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
        return (
          <span key={index} data-state={state} className={`inline-block ${color}`}>
            {ch === " " ? "\u00a0" : ch}
          </span>
        );
      })}
    </p>
  );
}

function RoundEnd({
  round,
  quiz,
  quizButtonRef,
  onQuiz,
  onHome,
}: {
  round: LearnRoundState;
  quiz: LearnQuizTransition | null;
  quizButtonRef: React.RefObject<HTMLButtonElement | null>;
  onQuiz: () => void;
  onHome: () => void;
}) {
  return (
    <div
      className="flex w-full flex-col items-center gap-4 text-center"
      data-testid="learn-round-end"
    >
      <h2 className="text-2xl font-bold text-perfect">ラウンド完了</h2>
      <p className="text-subtext">{round.terms.length} 語を読んで、打ちました。</p>
      <ul className="learn-learned" data-testid="learn-learned">
        {round.terms.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      {quiz ? (
        <p
          role="status"
          data-testid="learn-quiz-placeholder"
          data-next-phase={quiz.phase}
          data-term-ids={quiz.handoff.terms.map((item) => item.id).join(" ")}
          className="text-sm text-subtext"
        >
          理解度クイズは次の更新で始まります。
        </p>
      ) : (
        <button
          ref={quizButtonRef}
          type="button"
          data-testid="learn-to-quiz"
          data-next-phase="quiz"
          onClick={onQuiz}
          className="rounded-full bg-perfect px-8 py-3 font-bold text-bg focus-visible:ring-4 focus-visible:ring-fever"
        >
          理解度クイズへ
        </button>
      )}
      <button
        type="button"
        onClick={onHome}
        className="rounded-full border border-subtext px-8 py-3 text-subtext hover:text-text"
      >
        ホームへ戻る
      </button>
    </div>
  );
}
