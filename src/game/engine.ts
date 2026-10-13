/**
 * ゲームエンジン（docs/spec.md §3, §13, §18.1）。
 * React 非依存のステートマシン。時間は注入された `now()` 基準で、
 * スコア（scoring）・タイピング判定（typing）・問題選択（questions）を統合する。
 */
import {
  COUNTDOWN_MS,
  GAME_DURATION_MS,
  type Difficulty,
  type GameSession,
  type GameState,
  type Question,
  type QuestionResult,
} from "../types/game";
import { calcQuestionScore, calcXp, isFeverActive } from "./scoring";
import { createTypingState, inputChar, type TypingState } from "./typing";
import type { QuestionPicker } from "./questions";

/** UI / 演出 / 効果音向けの離散イベント（§9） */
export type EngineEvent =
  | { type: "countdown" }
  | { type: "start" }
  | { type: "correct"; char: string }
  | { type: "incorrect"; char: string }
  | { type: "clear"; perfect: boolean; score: number; combo: number; questionId: string }
  | { type: "combo"; combo: number }
  | { type: "fever_start" }
  | { type: "fever_end" }
  | { type: "skip"; questionId: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "finish"; aborted: boolean };

/** `useSyncExternalStore` で購読するスナップショット（イミュータブル） */
export interface EngineSnapshot {
  state: GameState;
  difficulty: Difficulty;
  /** カウントダウンの残り（ms）。COUNTDOWN 以外は 0 */
  countdownRemainingMs: number;
  /** ゲームの残り時間（ms）。一時停止中は進まない */
  remainingMs: number;
  /** ゲームの経過時間（ms）。一時停止中は進まない */
  elapsedMs: number;
  question: Question | null;
  typing: TypingState | null;
  /** 何問目か（1 始まり）。出題前は 0 */
  questionIndex: number;
  score: number;
  combo: number;
  maxCombo: number;
  solved: number;
  skipped: number;
  perfectSolved: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  fever: boolean;
  /** 直近のクリアで得たスコア（ScorePopup 用） */
  lastScoreGain: number;
  /** 直近のイベント。通し番号で同一イベントの再処理を防ぐ */
  lastEvent: EngineEvent | null;
  eventSeq: number;
}

export interface CreateEngineOptions {
  picker: QuestionPicker;
  difficulty: Difficulty;
  /** 単調増加する時刻（ms）。既定は performance.now() */
  now?: () => number;
  /** セッション ID 生成。既定は crypto.randomUUID 相当 */
  generateId?: () => string;
  /** 開始日時（ISO）の生成。既定は new Date().toISOString() */
  wallClock?: () => string;
  gameDurationMs?: number;
  countdownMs?: number;
}

export interface GameEngine {
  start(): void;
  /** 時間を進める。`t` を省略すると `now()` を使う */
  tick(t?: number): void;
  input(char: string): void;
  skip(): void;
  pause(): void;
  resume(): void;
  /** 途中終了。`completedAt` が null のセッションを生成する */
  abort(): void;
  /** FINISHED → RESULT */
  toResult(): void;
  getSnapshot(): EngineSnapshot;
  subscribe(listener: () => void): () => void;
  onEvent(handler: (event: EngineEvent) => void): () => void;
  /** FINISHED / RESULT 以降に取得できる */
  getSession(): GameSession | null;
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function createEngine({
  picker,
  difficulty,
  now = defaultNow,
  generateId = defaultId,
  wallClock = () => new Date().toISOString(),
  gameDurationMs = GAME_DURATION_MS,
  countdownMs = COUNTDOWN_MS,
}: CreateEngineOptions): GameEngine {
  let snapshot: EngineSnapshot = {
    state: "IDLE",
    difficulty,
    countdownRemainingMs: countdownMs,
    remainingMs: gameDurationMs,
    elapsedMs: 0,
    question: null,
    typing: null,
    questionIndex: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    solved: 0,
    skipped: 0,
    perfectSolved: 0,
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
    fever: false,
    lastScoreGain: 0,
    lastEvent: null,
    eventSeq: 0,
  };

  // 時間管理（§13.2）
  let countdownStartedAt = 0;
  let playStartedAt = 0;
  let pausedTotalMs = 0;
  let pauseStartedAt = 0;
  /** 現在の問題が出題された時点のゲーム経過時間 */
  let questionStartedElapsed = 0;
  let questionCorrect = 0;
  let questionIncorrect = 0;

  const results: QuestionResult[] = [];
  let session: GameSession | null = null;
  let sessionId = "";
  let startedAt = "";

  const listeners = new Set<() => void>();
  const eventHandlers = new Set<(event: EngineEvent) => void>();

  function emit(patch: Partial<EngineSnapshot>, event?: EngineEvent) {
    snapshot = event
      ? { ...snapshot, ...patch, lastEvent: event, eventSeq: snapshot.eventSeq + 1 }
      : { ...snapshot, ...patch };
    for (const l of listeners) l();
    if (event) for (const h of eventHandlers) h(event);
  }

  function elapsedAt(t: number): number {
    const raw = t - playStartedAt - pausedTotalMs;
    return Math.max(0, Math.min(gameDurationMs, raw));
  }

  function timePatch(t: number): Pick<EngineSnapshot, "elapsedMs" | "remainingMs"> {
    const elapsed = elapsedAt(t);
    return { elapsedMs: elapsed, remainingMs: gameDurationMs - elapsed };
  }

  function nextQuestion(
    elapsed: number,
  ): Pick<EngineSnapshot, "question" | "typing" | "questionIndex"> {
    const question = picker.next();
    questionStartedElapsed = elapsed;
    questionCorrect = 0;
    questionIncorrect = 0;
    return {
      question,
      typing: createTypingState(question.answer),
      questionIndex: snapshot.questionIndex + 1,
    };
  }

  function buildSession(completed: boolean): GameSession {
    const base = {
      id: sessionId,
      startedAt,
      completedAt: completed ? wallClock() : null,
      difficulty,
      score: snapshot.score,
      maxCombo: snapshot.maxCombo,
      solved: snapshot.solved,
      skipped: snapshot.skipped,
      perfectSolved: snapshot.perfectSolved,
      correctKeystrokes: snapshot.correctKeystrokes,
      incorrectKeystrokes: snapshot.incorrectKeystrokes,
      results: [...results],
    };
    return { ...base, xpEarned: calcXp(base) };
  }

  function recordCurrent(status: QuestionResult["status"], elapsed: number, perfect = false) {
    const q = snapshot.question;
    if (!q) return;
    results.push({
      questionId: q.id,
      status,
      durationMs: Math.max(0, elapsed - questionStartedElapsed),
      correctKeystrokes: questionCorrect,
      incorrectKeystrokes: questionIncorrect,
      perfect,
    });
  }

  function finish(t: number, aborted: boolean) {
    const elapsed = elapsedAt(t);
    if (snapshot.state === "PLAYING" || snapshot.state === "PAUSED") {
      // 入力途中の問題は timeout（§3.4）。途中終了も同様に未正解として残す
      if (snapshot.typing && !snapshot.typing.completed) recordCurrent("timeout", elapsed);
    }
    if (snapshot.state === "PAUSED") pausedTotalMs += t - pauseStartedAt;
    const completed = !aborted;
    emit({ state: "FINISHED", ...timePatch(t), countdownRemainingMs: 0, fever: false });
    session = buildSession(completed);
    emit({}, { type: "finish", aborted });
  }

  function comboPatch(nextCombo: number): Partial<EngineSnapshot> {
    const fever = isFeverActive(nextCombo);
    return {
      combo: nextCombo,
      maxCombo: Math.max(snapshot.maxCombo, nextCombo),
      fever,
    };
  }

  return {
    start() {
      if (snapshot.state !== "IDLE") return;
      const t = now();
      countdownStartedAt = t;
      sessionId = generateId();
      startedAt = wallClock();
      emit({ state: "COUNTDOWN", countdownRemainingMs: countdownMs }, { type: "countdown" });
    },

    tick(t = now()) {
      if (snapshot.state === "COUNTDOWN") {
        const remaining = countdownMs - (t - countdownStartedAt);
        if (remaining > 0) {
          emit({ countdownRemainingMs: remaining });
          return;
        }
        playStartedAt = countdownStartedAt + countdownMs;
        pausedTotalMs = 0;
        const elapsed = elapsedAt(t);
        emit(
          { state: "PLAYING", countdownRemainingMs: 0, ...timePatch(t), ...nextQuestion(elapsed) },
          { type: "start" },
        );
        if (elapsed >= gameDurationMs) finish(t, false);
        return;
      }
      if (snapshot.state === "PLAYING") {
        const elapsed = elapsedAt(t);
        if (elapsed >= gameDurationMs) {
          finish(t, false);
          return;
        }
        emit(timePatch(t));
      }
    },

    input(char) {
      if (snapshot.state !== "PLAYING" || !snapshot.typing || !snapshot.question) return;
      const t = now();
      const elapsed = elapsedAt(t);
      if (elapsed >= gameDurationMs) {
        finish(t, false);
        return;
      }
      const { state: typing, result } = inputChar(snapshot.typing, char);
      if (result === "ignored") return;

      if (result === "incorrect") {
        questionIncorrect += 1;
        const wasFever = snapshot.fever;
        const patch = {
          typing,
          incorrectKeystrokes: snapshot.incorrectKeystrokes + 1,
          ...comboPatch(0),
          ...timePatch(t),
        };
        emit(patch, { type: "incorrect", char });
        if (wasFever) emit({}, { type: "fever_end" });
        return;
      }

      questionCorrect += 1;
      const correctPatch = {
        typing,
        correctKeystrokes: snapshot.correctKeystrokes + 1,
        ...timePatch(t),
      };
      if (result === "correct") {
        emit(correctPatch, { type: "correct", char });
        return;
      }

      // completed（§3.2）
      const perfect = questionIncorrect === 0;
      const combo = snapshot.combo + 1;
      const gain = calcQuestionScore({ difficulty, combo, incorrectKeystrokes: questionIncorrect });
      const wasFever = snapshot.fever;
      const questionId = snapshot.question.id;
      recordCurrent("solved", elapsed, perfect);
      emit(
        {
          ...correctPatch,
          ...comboPatch(combo),
          score: snapshot.score + gain,
          solved: snapshot.solved + 1,
          perfectSolved: snapshot.perfectSolved + (perfect ? 1 : 0),
          lastScoreGain: gain,
          ...nextQuestion(elapsed),
        },
        { type: "clear", perfect, score: gain, combo, questionId },
      );
      emit({}, { type: "combo", combo });
      if (!wasFever && snapshot.fever) emit({}, { type: "fever_start" });
    },

    skip() {
      if (snapshot.state !== "PLAYING" || !snapshot.question) return;
      const t = now();
      const elapsed = elapsedAt(t);
      const questionId = snapshot.question.id;
      recordCurrent("skipped", elapsed);
      picker.markSkipped(questionId);
      const wasFever = snapshot.fever;
      emit(
        {
          skipped: snapshot.skipped + 1,
          ...comboPatch(0),
          ...timePatch(t),
          ...nextQuestion(elapsed),
        },
        { type: "skip", questionId },
      );
      if (wasFever) emit({}, { type: "fever_end" });
    },

    pause() {
      if (snapshot.state !== "PLAYING") return;
      const t = now();
      pauseStartedAt = t;
      emit({ state: "PAUSED", ...timePatch(t) }, { type: "pause" });
    },

    resume() {
      if (snapshot.state !== "PAUSED") return;
      const t = now();
      pausedTotalMs += t - pauseStartedAt;
      emit({ state: "PLAYING", ...timePatch(t) }, { type: "resume" });
    },

    abort() {
      if (snapshot.state === "FINISHED" || snapshot.state === "RESULT") return;
      if (snapshot.state === "IDLE") {
        sessionId = generateId();
        startedAt = wallClock();
      }
      finish(now(), true);
    },

    toResult() {
      if (snapshot.state !== "FINISHED") return;
      emit({ state: "RESULT" });
    },

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    onEvent(handler) {
      eventHandlers.add(handler);
      return () => {
        eventHandlers.delete(handler);
      };
    },

    getSession: () => session,
  };
}
