/**
 * 1 問分のタイピング判定（React 非依存の純関数）。
 * 仕様: docs/spec.md §5.2 入力判定、§5.3 PERFECT 判定、§5.4 キーボード操作、§3.4 時間切れ
 */

export interface TypingState {
  /** 入力対象の英語（元の表記のまま保持） */
  answer: string;
  /** 次に入力すべき位置 */
  cursor: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  lastInput: "correct" | "incorrect" | null;
  /** 全文字入力済み */
  completed: boolean;
}

/**
 * - `correct`: 正しい文字でカーソルが進んだ
 * - `incorrect`: 誤入力（カーソルは進まない）
 * - `completed`: 最後の文字が正しく入力され、全文字入力が完了した
 * - `ignored`: 判定対象外（制御キー、複数文字、完了後の入力）。状態は変化しない
 */
export type InputResult = "correct" | "incorrect" | "completed" | "ignored";

export function createTypingState(answer: string): TypingState {
  return {
    answer,
    cursor: 0,
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
    lastInput: null,
    completed: false,
  };
}

/** 次に入力すべき文字。完了済みなら null */
export function expectedChar(state: TypingState): string | null {
  return state.cursor < state.answer.length ? state.answer[state.cursor]! : null;
}

/**
 * 1 文字を入力する。
 * - 大文字・小文字を区別しない
 * - Space や記号は answer の該当位置に含まれる場合のみ正解
 * - 誤入力ではカーソルを進めず `incorrectKeystrokes` を加算
 * - Backspace 等の制御キーや複数文字の文字列は無視
 */
export function inputChar(
  state: TypingState,
  char: string,
): { state: TypingState; result: InputResult } {
  if (state.completed || !isSingleChar(char)) {
    return { state, result: "ignored" };
  }

  const expected = expectedChar(state);
  if (expected === null) {
    return { state, result: "ignored" };
  }

  if (char.toLowerCase() !== expected.toLowerCase()) {
    return {
      state: {
        ...state,
        incorrectKeystrokes: state.incorrectKeystrokes + 1,
        lastInput: "incorrect",
      },
      result: "incorrect",
    };
  }

  const cursor = state.cursor + 1;
  const completed = cursor >= state.answer.length;
  return {
    state: {
      ...state,
      cursor,
      correctKeystrokes: state.correctKeystrokes + 1,
      lastInput: "correct",
      completed,
    },
    result: completed ? "completed" : "correct",
  };
}

/** PERFECT 判定（§5.3）: 誤入力 0 でクリア */
export function isPerfect(state: TypingState): boolean {
  return state.completed && state.incorrectKeystrokes === 0;
}

/** 単一の印字可能文字（サロゲートペア対応）かどうか。"Backspace" 等のキー名は除外 */
function isSingleChar(char: string): boolean {
  return char.length > 0 && [...char].length === 1;
}
