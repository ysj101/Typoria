import { memo, useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { useAppNavigate } from "../app/navigation";
import { selectTerms, TERMS } from "../data/terms";
import { LearnQuizView } from "../components/LearnQuizView";
import {
  answerLearnQuiz,
  createLearnQuiz,
  createLearnRoundResult,
  termSummary,
  type LearnQuizState,
  type QuizChoiceIndex,
} from "../game/learnQuiz";
import {
  captureLearnResume,
  clearLearnResume,
  emphasizeTermName,
  loadLearnResume,
  restoreLearnSession,
  saveLearnResume,
  shouldCollapseLearnExplanation,
  type LearnResumeSession,
} from "../game/learnResume";
import {
  beginTyping,
  createLearnRound,
  currentTerm,
  inputLearnChar,
  requestQuiz,
  type LearnRoundState,
} from "../game/learnRound";
import type { TypingState } from "../game/typing";
import { isKeyboardChromeTarget, useKeyboard } from "../hooks/useKeyboard";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { TERM_CATEGORY_LABELS, type Term } from "../types/term";
import "./Learn.css";

export interface LearnProps {
  /** 未指定なら全カテゴリから既定の 3 語 */
  terms?: readonly Term[];
  /** 理解度クイズの出題と選択肢シャッフル。未指定は Math.random */
  rng?: () => number;
  /** クイズの回答時刻。未指定は現在時刻 */
  now?: () => Date;
}

function createInitialSession(terms: readonly Term[] | undefined): LearnResumeSession {
  const catalog = terms ?? TERMS;
  const saved = loadLearnResume();
  if (saved) {
    const restored = restoreLearnSession(saved, catalog);
    if (restored) return restored;
    clearLearnResume();
  }
  return { round: createLearnRound(terms ?? selectTerms()), quiz: null };
}

/**
 * 学習モード（#74 / #75 / #77）。
 * 1 ラウンドは「解説を読む → typingText を打つ」を既定 3 語くり返し、
 * ラウンド終了後に理解度クイズへ進む。
 * タブの切り替えや画面ロックでは、同じ用語・同じフェーズから再開する。
 */
export function Learn({ terms, rng, now }: LearnProps) {
  const nav = useAppNavigate();
  const { compact, inset } = useVisualViewport();
  const [initial] = useState(() => createInitialSession(terms));
  const [round, setRound] = useState<LearnRoundState>(initial.round);
  const [quiz, setQuiz] = useState<LearnQuizState | null>(initial.quiz);
  const containerRef = useRef<HTMLElement>(null);
  const typingInputRef = useRef<HTMLInputElement>(null);
  const beginButtonRef = useRef<HTMLButtonElement>(null);
  const quizButtonRef = useRef<HTMLButtonElement>(null);
  const answerRef = useRef<HTMLParagraphElement>(null);

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

  // 進行状態を常に残し、タブ切り替え・画面ロック・戻る操作のどれからでも同じ所へ戻す
  useEffect(() => {
    saveLearnResume(captureLearnResume(round, quiz));
  }, [round, quiz]);

  useEffect(() => {
    if (round.phase === "typing") return;
    if (document.activeElement === typingInputRef.current) {
      typingInputRef.current?.blur();
    }
  }, [round.phase]);

  useEffect(() => {
    if (quiz) return;
    if (round.phase === "reading") beginButtonRef.current?.focus();
    if (round.phase === "roundEnd") quizButtonRef.current?.focus();
    if (round.phase === "typing") focusTypingInput();
  }, [quiz, round.phase, round.index, focusTypingInput]);

  const typing = round.phase === "typing";
  const collapsed = shouldCollapseLearnExplanation(round.phase, {
    short: compact,
    keyboardInset: inset,
  });

  useEffect(() => {
    if (!typing) return;
    const node = answerRef.current;
    if (!node || typeof node.scrollIntoView !== "function") return;
    node.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [typing, round.index, collapsed]);
  const keepSoftKeyboard = useCallback(
    (event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
      if (!typing || isKeyboardChromeTarget(event.target)) return;
      event.preventDefault();
      focusTypingInput();
    },
    [typing, focusTypingInput],
  );

  const leave = () => {
    clearLearnResume();
    nav.toHome();
  };
  const term = currentTerm(round);
  const phase = quiz ? "quiz" : round.phase;
  const progressCurrent = round.phase === "roundEnd" ? round.terms.length : round.index + 1;
  const progressTotal = round.terms.length;
  const onQuiz = () => {
    const next = requestQuiz(round);
    if (!next) return;
    setQuiz(createLearnQuiz(next.handoff.terms, { rng }));
  };
  const onAnswer = (sourceIndex: QuizChoiceIndex) => {
    setQuiz((current) => (current ? answerLearnQuiz(current, sourceIndex, now) : current));
  };
  const onLearnResult = () => {
    if (!quiz?.result) return;
    clearLearnResume();
    nav.toLearnResult(createLearnRoundResult(round.terms, quiz.result));
  };

  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      aria-label={phase === "quiz" ? "理解度クイズ" : "学習ラウンド"}
      className={`learn-screen outline-none${compact ? " learn-screen--compact" : ""}`}
      data-testid="learn"
      data-phase={phase}
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
        <header className="learn-header">
          <h1 className="learn-title text-subtext">IT基礎用語</h1>
          <div className="learn-toolbar">
            <p className="learn-kicker text-subtext">
              <span
                data-testid="learn-progress"
                aria-label={`用語 ${progressCurrent} / ${progressTotal}`}
              >
                {progressCurrent} / {progressTotal}
              </span>
              {term && (
                <span data-testid="learn-category">{TERM_CATEGORY_LABELS[term.category]}</span>
              )}
              {quiz && <span>理解度クイズ</span>}
            </p>
            <button type="button" data-testid="learn-quit" onClick={leave} className="learn-quit">
              やめる
            </button>
          </div>
          {term && (
            <h2 className="learn-name" data-testid="learn-name">
              {term.name}
            </h2>
          )}
        </header>

        {term && <LearnExplanation term={term} collapsed={collapsed} />}

        <div className={`learn-stage${phase === "quiz" ? " learn-stage--quiz" : ""}`}>
          {round.phase === "reading" && term && (
            <button
              ref={beginButtonRef}
              type="button"
              onClick={onBeginTyping}
              className="rounded-full bg-perfect px-12 py-3 text-xl font-bold text-bg focus-visible:ring-4 focus-visible:ring-fever"
            >
              打つ
            </button>
          )}
          {round.phase === "typing" && round.typing && (
            <LearnAnswer typing={round.typing} answerRef={answerRef} />
          )}
          {phase === "roundEnd" && (
            <RoundEnd round={round} quizButtonRef={quizButtonRef} onQuiz={onQuiz} onHome={leave} />
          )}
          {quiz && <LearnQuizView quiz={quiz} onAnswer={onAnswer} onResult={onLearnResult} />}
        </div>

        {typing && (
          <footer className="learn-footer text-sm text-subtext">
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
          </footer>
        )}
      </div>
    </section>
  );
}

const LearnExplanation = memo(function LearnExplanation({
  term,
  collapsed,
}: {
  term: Term;
  collapsed: boolean;
}) {
  const text = collapsed ? termSummary(term.explanation) : term.explanation;
  const parts = emphasizeTermName(text, term.name);
  return (
    <p
      id="learn-explanation-text"
      className={`learn-explanation${collapsed ? " learn-explanation--collapsed" : ""}`}
      data-testid="learn-explanation"
      data-collapsed={collapsed ? "true" : "false"}
      tabIndex={collapsed ? undefined : 0}
    >
      {parts.map((part, index) =>
        part.term ? (
          <strong key={index} className="learn-term">
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
});

function LearnAnswer({
  typing,
  answerRef,
}: {
  typing: TypingState;
  answerRef: React.RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <p
      ref={answerRef}
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
  quizButtonRef,
  onQuiz,
  onHome,
}: {
  round: LearnRoundState;
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
      <button
        ref={quizButtonRef}
        type="button"
        data-testid="learn-to-quiz"
        data-next-phase="quiz"
        onClick={onQuiz}
        className="learn-tap rounded-full bg-perfect px-8 py-3 font-bold text-bg focus-visible:ring-4 focus-visible:ring-fever"
      >
        理解度クイズへ
      </button>
      <button
        type="button"
        onClick={onHome}
        className="learn-tap rounded-full border border-subtext px-8 py-3 text-subtext hover:text-text"
      >
        ホームへ戻る
      </button>
    </div>
  );
}
