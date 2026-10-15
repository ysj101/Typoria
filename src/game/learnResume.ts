/**
 * 学習モードの中断と復帰（#77）。
 * 進行状態を sessionStorage に残し、タブ切り替え・画面ロックから戻ったときに
 * 同じ用語・同じフェーズから再開する。永続化（IndexedDB）は #76。
 */
import type { Term } from "../types/term";
import { isLearnQuizResult, isQuizChoiceIndex, type LearnQuizState } from "./learnQuiz";
import { LEARN_PHASES, type LearnPhase, type LearnRoundState } from "./learnRound";
import { createTypingState, type TypingState } from "./typing";

export const LEARN_RESUME_STORAGE_KEY = "typoria.learn.resume";

/** この差以上はソフトキーボードが可視領域を覆っているとみなす */
export const LEARN_KEYBOARD_INSET_PX = 80;

export interface LearnResumeSnapshot {
  v: 1;
  termIds: string[];
  index: number;
  phase: LearnPhase;
  /** `typing` のとき、次に打つ位置 */
  cursor: number;
  quiz: LearnQuizState | null;
}

export interface LearnResumeSession {
  round: LearnRoundState;
  quiz: LearnQuizState | null;
}

/**
 * 打つフェーズで解説を要点 1 行に畳む。
 * 可視領域が低い（ソフトキーボードや横持ち）か、キーボード分の inset があるとき。
 */
export function shouldCollapseLearnExplanation(
  phase: LearnPhase,
  viewport: { short: boolean; keyboardInset: number },
): boolean {
  return (
    phase === "typing" && (viewport.short || viewport.keyboardInset >= LEARN_KEYBOARD_INSET_PX)
  );
}

/** 解説文のなかの用語名。出現箇所をすべて強調する */
export function emphasizeTermName(
  text: string,
  name: string,
): Array<{ text: string; term: boolean }> {
  if (name.length === 0) return [{ text, term: false }];
  return text
    .split(name)
    .flatMap((chunk, index) =>
      index === 0
        ? [{ text: chunk, term: false }]
        : [
            { text: name, term: true },
            { text: chunk, term: false },
          ],
    )
    .filter((part) => part.text.length > 0);
}

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function isLearnPhase(value: unknown): value is LearnPhase {
  return (LEARN_PHASES as readonly unknown[]).includes(value);
}

function isLearnQuizState(value: unknown): value is LearnQuizState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.phase !== "asking" && v.phase !== "feedback") return false;
  if (!v.question || typeof v.question !== "object") return false;
  const question = v.question as Record<string, unknown>;
  if (
    typeof question.termId !== "string" ||
    question.termId.length === 0 ||
    typeof question.termName !== "string" ||
    typeof question.question !== "string" ||
    typeof question.explanation !== "string" ||
    !isQuizChoiceIndex(question.answerSourceIndex)
  ) {
    return false;
  }
  if (!Array.isArray(question.choices) || question.choices.length !== 4) return false;
  for (const choice of question.choices) {
    if (!choice || typeof choice !== "object") return false;
    const item = choice as Record<string, unknown>;
    if (!isQuizChoiceIndex(item.sourceIndex) || typeof item.text !== "string") return false;
  }
  if (v.phase === "asking") return v.selectedSourceIndex === null && v.result === null;
  return (
    isQuizChoiceIndex(v.selectedSourceIndex) &&
    isLearnQuizResult(v.result) &&
    v.result.termId === question.termId
  );
}

function isSnapshot(value: unknown): value is LearnResumeSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return false;
  if (
    !Array.isArray(v.termIds) ||
    v.termIds.length === 0 ||
    v.termIds.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    return false;
  }
  if (!isLearnPhase(v.phase)) return false;
  if (typeof v.index !== "number" || !Number.isInteger(v.index) || v.index < 0) return false;
  if (typeof v.cursor !== "number" || !Number.isInteger(v.cursor) || v.cursor < 0) return false;
  if (v.quiz !== null && !isLearnQuizState(v.quiz)) return false;
  if (v.quiz !== null && v.phase !== "roundEnd") return false;
  return true;
}

export function captureLearnResume(
  round: LearnRoundState,
  quiz: LearnQuizState | null,
): LearnResumeSnapshot {
  return {
    v: 1,
    termIds: round.terms.map((term) => term.id),
    index: round.index,
    phase: round.phase,
    cursor: round.typing?.cursor ?? 0,
    quiz: round.phase === "roundEnd" ? quiz : null,
  };
}

export function saveLearnResume(snapshot: LearnResumeSnapshot): void {
  storage()?.setItem(LEARN_RESUME_STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadLearnResume(): LearnResumeSnapshot | null {
  const raw = storage()?.getItem(LEARN_RESUME_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLearnResume(): void {
  storage()?.removeItem(LEARN_RESUME_STORAGE_KEY);
}

/** 途中まで正しく打った状態。誤入力の履歴は残さない */
function typingWithCursor(answer: string, cursor: number): TypingState {
  return {
    ...createTypingState(answer),
    cursor,
    correctKeystrokes: cursor,
    lastInput: cursor > 0 ? "correct" : null,
  };
}

/**
 * 保存したスナップショットを、いま使える用語一覧で復元する。
 * 用語が足りない・カーソルが範囲外なら null（新しいラウンドを始める）。
 */
export function restoreLearnSession(
  snapshot: LearnResumeSnapshot,
  catalog: readonly Term[],
): LearnResumeSession | null {
  const byId = new Map(catalog.map((term) => [term.id, term]));
  const terms: Term[] = [];
  for (const id of snapshot.termIds) {
    const term = byId.get(id);
    if (!term) return null;
    terms.push(term);
  }

  const { phase, index } = snapshot;
  const term = terms[index];
  if (phase === "roundEnd") {
    if (index !== terms.length) return null;
    if (snapshot.quiz && !terms.some((item) => item.id === snapshot.quiz?.question.termId)) {
      return null;
    }
  } else if (!term) {
    return null;
  } else if (phase === "typing" && snapshot.cursor >= term.typingText.length) {
    return null;
  }

  const typing =
    phase === "typing" && term ? typingWithCursor(term.typingText, snapshot.cursor) : null;
  return {
    round: { phase, terms, index, typing },
    quiz: phase === "roundEnd" ? snapshot.quiz : null,
  };
}
