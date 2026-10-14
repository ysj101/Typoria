/**
 * 学習ラウンドの状態遷移（読む → 打つ → ラウンド終了）。
 * React 非依存。打鍵判定は `typing.ts` に委譲する。
 * ラウンド終了後の理解度クイズ（#75）へは `requestQuiz` で渡す。
 */
import type { Term } from "../types/term";
import { createTypingState, inputChar, type InputResult, type TypingState } from "./typing";

/** 1 語の中のフェーズ。3 語目を打ち終えると roundEnd */
export const LEARN_PHASES = ["reading", "typing", "roundEnd"] as const;

export type LearnPhase = (typeof LEARN_PHASES)[number];

/** #75 が実装する、ラウンド終了の次フェーズ */
export const LEARN_NEXT_PHASE = "quiz" as const;

export type LearnNextPhase = typeof LEARN_NEXT_PHASE;

export interface LearnRoundState {
  phase: LearnPhase;
  /** 出題順。ラウンド中は入れ替えない */
  terms: readonly Term[];
  /**
   * いま読んでいる / 打っている用語の位置。
   * `roundEnd` では `terms.length`（現在の用語はない）。
   */
  index: number;
  /** `typing` のときだけ打鍵状態を持つ */
  typing: TypingState | null;
}

export interface LearnInputOutcome {
  state: LearnRoundState;
  result: InputResult;
  /** この入力で 1 語を打ち終えた */
  termCompleted: boolean;
  /** この入力でラウンドが終わった */
  roundCompleted: boolean;
}

/** #75 のクイズへ渡す、このラウンドで扱った用語 */
export interface LearnQuizHandoff {
  terms: readonly Term[];
}

export interface LearnQuizTransition {
  phase: LearnNextPhase;
  handoff: LearnQuizHandoff;
}

/** 空のラウンドは始めない。用語の並びがそのまま出題順になる */
export function createLearnRound(terms: readonly Term[]): LearnRoundState {
  if (terms.length === 0) {
    throw new Error("createLearnRound: terms must not be empty");
  }
  return {
    phase: "reading",
    terms: terms.slice(),
    index: 0,
    typing: null,
  };
}

/** 読む / 打つフェーズの用語。ラウンド終了後は null */
export function currentTerm(state: LearnRoundState): Term | null {
  if (state.phase === "roundEnd") return null;
  return state.terms[state.index] ?? null;
}

/**
 * 読むフェーズの「打つ」。時間制限はなく、呼ぶまで typing に進まない。
 * 読むフェーズ以外では状態を変えない。
 */
export function beginTyping(state: LearnRoundState): LearnRoundState {
  if (state.phase !== "reading") return state;
  const term = state.terms[state.index];
  if (!term) return state;
  return {
    ...state,
    phase: "typing",
    typing: createTypingState(term.typingText),
  };
}

/**
 * 打つフェーズの 1 文字。
 * 1 語を打ち終えると次の用語の読むフェーズへ戻る。
 * 最後の用語なら `roundEnd`。読む / 終了中の入力は無視する。
 */
export function inputLearnChar(state: LearnRoundState, char: string): LearnInputOutcome {
  if (state.phase !== "typing" || state.typing === null) {
    return { state, result: "ignored", termCompleted: false, roundCompleted: false };
  }

  const next = inputChar(state.typing, char);
  if (next.result === "ignored") {
    return { state, result: "ignored", termCompleted: false, roundCompleted: false };
  }
  if (next.result !== "completed") {
    return {
      state: { ...state, typing: next.state },
      result: next.result,
      termCompleted: false,
      roundCompleted: false,
    };
  }

  const nextIndex = state.index + 1;
  if (nextIndex < state.terms.length) {
    return {
      state: {
        phase: "reading",
        terms: state.terms,
        index: nextIndex,
        typing: null,
      },
      result: "completed",
      termCompleted: true,
      roundCompleted: false,
    };
  }

  return {
    state: {
      phase: "roundEnd",
      terms: state.terms,
      index: state.terms.length,
      typing: null,
    },
    result: "completed",
    termCompleted: true,
    roundCompleted: true,
  };
}

/**
 * ラウンド終了後に #75 の理解度クイズへ進むためのフック。
 * 終了前は null。用語は出題順のまま渡す。
 */
export function requestQuiz(state: LearnRoundState): LearnQuizTransition | null {
  if (state.phase !== "roundEnd") return null;
  return {
    phase: LEARN_NEXT_PHASE,
    handoff: { terms: state.terms },
  };
}
