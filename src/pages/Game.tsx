import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useAppNavigate } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { GameHUD } from "../components/GameHUD";
import { ParticleEffect } from "../components/ParticleEffect";
import { ScorePopupLayer } from "../components/ScorePopup";
import { TypingInput } from "../components/TypingInput";
import "../components/GameFx.css";
import "../components/GameScreen.css";
import { QUESTIONS } from "../data/questions";
import { resolveDifficulty } from "../game/difficulty";
import { selectWeakQuestions } from "../game/questions";
import { applySessionResult, type SessionDatabase } from "../game/session";
import { getSharedAudioEngine } from "../hooks/useAudio";
import { useGame, type UseGameOptions } from "../hooks/useGame";
import { useGameAudio } from "../hooks/useGameAudio";
import { useGameFx } from "../hooks/useGameFx";
import { useKeyboard } from "../hooks/useKeyboard";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { db } from "../storage";
import type { Difficulty, Question, QuestionStat } from "../types/game";

/** 画面遷移のアニメーション時間（docs/spec.md §9.1） */
const RESULT_TRANSITION_MS = 400;

/** ボタンやダイアログ上のタップでは、ソフトキーボード用 input へフォーカスを移さない */
function isKeyboardChromeTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, a, textarea, select, [role='dialog']"))
  );
}

export type GameDatabase = SessionDatabase & { getQuestionStats(): Promise<QuestionStat[]> };

export interface GameProps {
  database?: GameDatabase;
  questions?: Question[];
  createGameEngine?: UseGameOptions["createGameEngine"];
}

/** ゲーム画面（docs/spec.md §4.2, §3, §13.2, AC-01〜AC-05, AC-15） */
export function Game({ database = db, questions = QUESTIONS, createGameEngine }: GameProps) {
  const { ready, settings, progress } = useAppContext();
  const { compact } = useVisualViewport();
  const [weakIds, setWeakIds] = useState<string[] | null>(null);
  const difficulty = resolveDifficulty(settings.difficultyMode, progress);

  // 苦手問題（§7.3）を読み込んでからエンジンを生成する
  useEffect(() => {
    let cancelled = false;
    void database
      .getQuestionStats()
      .then((stats) => {
        if (!cancelled) setWeakIds(selectWeakQuestions(stats));
      })
      .catch(() => {
        if (!cancelled) setWeakIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [database]);

  // 設定・進捗（AppProvider）と苦手問題の両方が揃ってからエンジンを生成する。
  // 設定の読み込み前に開始すると既定値（効果音 ON など）でゲームが始まってしまう（AC-14）
  const loading = !ready || weakIds === null;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col" aria-busy={loading}>
      <h1 className="sr-only">Game</h1>
      {loading || weakIds === null ? (
        <p className="flex flex-1 items-center justify-center text-subtext">Loading...</p>
      ) : (
        <GameSession
          difficulty={difficulty}
          questions={questions}
          weakQuestionIds={weakIds}
          database={database}
          createGameEngine={createGameEngine}
          compact={compact}
        />
      )}
    </div>
  );
}

interface GameSessionProps {
  difficulty: Difficulty;
  questions: Question[];
  weakQuestionIds: string[];
  database: GameDatabase;
  createGameEngine?: UseGameOptions["createGameEngine"];
  compact: boolean;
}

function GameSession({
  difficulty,
  questions,
  weakQuestionIds,
  database,
  createGameEngine,
  compact,
}: GameSessionProps) {
  const nav = useAppNavigate();
  const { refresh, settings } = useAppContext();
  const { engine, snapshot } = useGame({
    difficulty,
    questions,
    weakQuestionIds,
    createGameEngine,
  });
  // 効果音・BGM の結線（#24）
  useGameAudio(engine, settings);
  // 最初の click / touch で AudioContext を unlock する（iOS Chrome はタッチ操作が必須）
  const unlockAudio = useCallback(() => {
    void getSharedAudioEngine().unlock();
  }, []);
  // 演出（#23）。ゲーム進行はブロックしない（§18.3）
  const reducedMotion = useReducedMotion();
  const fx = useGameFx(engine, snapshot, { settings, reducedMotion });
  const containerRef = useRef<HTMLElement>(null);
  const typingInputRef = useRef<HTMLInputElement>(null);
  // 確定処理の中で使う最新の依存を ref に保持し、effect の再実行で遷移が取り消されないようにする
  const depsRef = useRef({ nav, refresh, database });
  useLayoutEffect(() => {
    depsRef.current = { nav, refresh, database };
  });
  const finishedRef = useRef(false);

  // ソフトキーボードを開く。iOS Chrome はユーザー操作の同期処理でしかキーボードが出ない（#59）
  const focusTypingInput = useCallback(() => {
    typingInputRef.current?.focus({ preventScroll: true });
  }, []);

  // 開始: マウント時にカウントダウンへ（AC-01）。input へフォーカスしてキーボードを出せるようにする
  useEffect(() => {
    engine.start();
    focusTypingInput();
  }, [engine, focusTypingInput]);

  useEffect(() => {
    if (snapshot.state === "COUNTDOWN" || snapshot.state === "PLAYING") {
      focusTypingInput();
      return;
    }
    // 一時停止・終了ではキーボードを閉じる。ダイアログ側のフォーカスは奪わない
    if (document.activeElement === typingInputRef.current) {
      typingInputRef.current?.blur();
    }
  }, [snapshot.state, focusTypingInput]);

  // 入力（#14, #59）。同期的にエンジンへ反映する（§18.2）
  const onChar = useCallback((ch: string) => engine.input(ch), [engine]);
  const onSkip = useCallback(() => engine.skip(), [engine]);
  const onPause = useCallback(() => {
    const state = engine.getSnapshot().state;
    if (state === "PLAYING") {
      engine.pause();
      typingInputRef.current?.blur();
    } else if (state === "PAUSED") {
      engine.resume();
      // 再開後は入力欄へ戻し、ソフトキーボードを再び出せるようにする（§14, #59）
      focusTypingInput();
    }
  }, [engine, focusTypingInput]);
  useKeyboard({
    enabled: snapshot.state === "PLAYING" || snapshot.state === "PAUSED",
    onChar,
    onSkip,
    onPause,
    target: containerRef,
    textInput: typingInputRef,
  });

  // タブ非表示で自動一時停止（§3.5）
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && engine.getSnapshot().state === "PLAYING") {
        engine.pause();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [engine]);

  // FINISHED → セッション確定（#17）→ Result へ遷移（§9.1: 400ms）
  useEffect(() => {
    if (snapshot.state !== "FINISHED" || finishedRef.current) return;
    finishedRef.current = true;
    const session = engine.getSession();
    if (!session) return;
    void (async () => {
      const { nav, refresh, database } = depsRef.current;
      const result = await applySessionResult(session, { db: database });
      await refresh();
      engine.toResult();
      if (session.completedAt === null) {
        nav.toHome();
        return;
      }
      setTimeout(() => {
        depsRef.current.nav.toResult({
          session: result.session,
          isNewRecord: result.isNewRecord,
          missionRewards: result.missionRewards,
          nextDifficulty: result.nextDifficulty,
          streak: result.streak,
        });
      }, RESULT_TRANSITION_MS);
    })();
  }, [snapshot.state, engine]);

  // スコア・コンボの控えめな通知（§14: 問題クリア時のみ更新）
  const clearedCount = snapshot.solved + snapshot.skipped;
  const announcement = useMemo(() => {
    if (clearedCount === 0) return "";
    const s = engine.getSnapshot();
    return `${s.solved} 問クリア、スコア ${s.score}、コンボ ${s.combo}`;
  }, [clearedCount, engine]);

  const resumeAndFocus = useCallback(() => {
    engine.resume();
    focusTypingInput();
  }, [engine, focusTypingInput]);

  const keyboardOpen = snapshot.state === "COUNTDOWN" || snapshot.state === "PLAYING";

  // 画面・問題エリアのタップで入力欄へ戻す。preventDefault でフォーカス移動を止め、キーボードを閉じさせない
  const keepSoftKeyboard = useCallback(
    (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
      if (!keyboardOpen || isKeyboardChromeTarget(e.target)) return;
      e.preventDefault();
      focusTypingInput();
    },
    [keyboardOpen, focusTypingInput],
  );

  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      aria-label="ゲーム"
      className={`game-screen outline-none${compact ? " game-screen--compact" : ""}`}
      data-testid="game"
      data-state={snapshot.state}
      data-compact={compact ? "true" : "false"}
      onKeyDownCapture={unlockAudio}
      onClickCapture={unlockAudio}
      onMouseDown={keepSoftKeyboard}
      onTouchStart={keepSoftKeyboard}
      onPointerDownCapture={unlockAudio}
      onTouchStartCapture={unlockAudio}
      onTouchEndCapture={unlockAudio}
      onContextMenu={(event) => event.preventDefault()}
      data-shake={fx.shakeAttr}
    >
      <input
        ref={typingInputRef}
        type="text"
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
      {settings.particles && <ParticleEffect particles={fx.particles} />}
      <div className="game-screen__column">
        <GameHUD
          score={snapshot.score}
          remainingMs={snapshot.remainingMs}
          combo={snapshot.combo}
          fever={snapshot.fever}
          animate={fx.animate}
        />

        <div className="game-playfield" data-testid="problem-area">
          {snapshot.state === "COUNTDOWN" && (
            <Countdown remainingMs={snapshot.countdownRemainingMs} />
          )}
          {snapshot.question && snapshot.typing && snapshot.state !== "COUNTDOWN" && (
            <div className="relative w-full min-w-0">
              <ScorePopupLayer popups={fx.popups} animate={fx.animate} />
              {fx.ghost && (
                <TypingInput
                  key={fx.ghost.id}
                  question={fx.ghost.question}
                  typing={{
                    answer: fx.ghost.question.answer,
                    cursor: fx.ghost.question.answer.length,
                    correctKeystrokes: 0,
                    incorrectKeystrokes: 0,
                    lastInput: null,
                    completed: true,
                  }}
                  ghost
                />
              )}
              <TypingInput
                question={snapshot.question}
                typing={snapshot.typing}
                charAnimKey={fx.animate ? fx.charAnimKey : undefined}
              />
            </div>
          )}
          {snapshot.state === "FINISHED" && (
            <p className="text-2xl font-bold text-perfect" role="status">
              TIME UP!
            </p>
          )}
        </div>

        <p className="sr-only" aria-live="polite" data-testid="game-announcement">
          {announcement}
        </p>

        <footer className="game-footer text-subtext">
          {keyboardOpen && (
            <button
              type="button"
              data-testid="open-keyboard"
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => {
                e.preventDefault();
                focusTypingInput();
              }}
              onClick={focusTypingInput}
              className="game-footer__button hover:border-text hover:text-text"
            >
              キーボードを開く
            </button>
          )}
          <button
            type="button"
            onClick={onPause}
            disabled={snapshot.state !== "PLAYING"}
            className="game-footer__button hover:border-text hover:text-text"
          >
            一時停止
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={snapshot.state !== "PLAYING"}
            className="game-footer__button hover:border-text hover:text-text"
          >
            スキップ<span className="game-footer__hint">（Ctrl + Enter）</span>
          </button>
        </footer>
      </div>

      {snapshot.state === "PAUSED" && (
        <PauseOverlay onResume={resumeAndFocus} onQuit={() => engine.abort()} />
      )}
    </section>
  );
}

function Countdown({ remainingMs }: { remainingMs: number }) {
  const n = Math.max(1, Math.ceil(remainingMs / 1000));
  return (
    <div
      className="game-countdown font-bold tabular-nums text-perfect"
      role="timer"
      aria-live="assertive"
      data-testid="countdown"
    >
      {n}
    </div>
  );
}

function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // フォーカストラップ: Tab / Shift+Tab がダイアログ内のボタンを循環する（§14 a11y）。
  // Safari は既定で Tab がボタンに止まらないため、ブラウザ任せにせず常に自前で移動する（docs/verification.md）
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    if (focusable.length === 0) return;
    e.preventDefault();
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    const delta = e.shiftKey ? -1 : 1;
    const next =
      index === -1
        ? e.shiftKey
          ? focusable.length - 1
          : 0
        : (index + delta + focusable.length) % focusable.length;
    focusable[next]!.focus();
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="一時停止"
      onKeyDown={onKeyDown}
      className="pause-overlay fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm"
      data-testid="pause-overlay"
    >
      <p className="pause-title text-4xl font-bold tracking-widest">PAUSED</p>
      <p className="text-subtext">Esc で再開</p>
      <div className="flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={onResume}
          autoFocus
          className="rounded-full bg-perfect px-8 py-3 font-bold text-bg focus-visible:ring-4 focus-visible:ring-fever"
        >
          再開
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="rounded-full border border-subtext px-8 py-3 text-subtext hover:text-text focus-visible:ring-4 focus-visible:ring-fever"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
