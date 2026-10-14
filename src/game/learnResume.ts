/**
 * 学習モードの中断と復帰（#77）。
 * タブ切り替え・画面ロックの `visibilitychange` で sessionStorage に残し、
 * 戻ったときに同じ用語・同じフェーズから再開する。永続化（IndexedDB）は #76。
 */
import type { Term } from "../types/term";
import type { LearnQuizState, QuizChoiceIndex } from "./learnQuiz";
import { createLearnRound, type LearnPhase, type LearnRoundState } from "./learnRound";
import { createTypingState, inputChar, type TypingState } from "./typing";

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
  if (name.length === 0 || !text.includes(name)) return [{ text, term: false }];
  const parts: Array<{ text: string; term: boolean }> = [];
  let rest = text;
  while (rest.length > 0) {
    const index = rest.indexOf(name);
    if (index === -1) {
      parts.push({ text: rest, term: false });
      break;
    }
    if (index > 0) parts.push({ text: rest.slice(0, index), term: false });
    parts.push({ text: name, term: true });
    rest = rest.slice(index + name.length);
  }
  return parts;
}

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function isQuizChoiceIndex(value: unknown): value is QuizChoiceIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isLearnPhase(value: unknown): value is LearnPhase {
  return value === "reading" || value === "typing" || value === "roundEnd";
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
  if (!isQuizChoiceIndex(v.selectedSourceIndex)) return false;
  if (!v.result || typeof v.result !== "object") return false;
  const result = v.result as Record<string, unknown>;
  return (
    result.termId === question.termId &&
    typeof result.correct === "boolean" &&
    typeof result.answeredAt === "string" &&
    result.answeredAt.length > 0
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

function typingWithCursor(answer: string, cursor: number): TypingState {
  let state = createTypingState(answer);
  for (const ch of answer.slice(0, cursor)) {
    const next = inputChar(state, ch);
    if (next.result !== "correct") return createTypingState(answer);
    state = next.state;
  }
  return state;
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

  if (snapshot.phase === "roundEnd") {
    if (snapshot.index !== terms.length) return null;
    if (snapshot.quiz && !terms.some((term) => term.id === snapshot.quiz?.question.termId)) {
      return null;
    }
    const round = createLearnRound(terms);
    return {
      round: { ...round, phase: "roundEnd", index: terms.length, typing: null },
      quiz: snapshot.quiz,
    };
  }

  if (snapshot.index >= terms.length) return null;
  const term = terms[snapshot.index];
  if (!term) return null;

  if (snapshot.phase === "reading") {
    const round = createLearnRound(terms);
    return {
      round: { ...round, phase: "reading", index: snapshot.index, typing: null },
      quiz: null,
    };
  }

  if (snapshot.cursor >= term.typingText.length) return null;
  const round = createLearnRound(terms);
  return {
    round: {
      ...round,
      phase: "typing",
      index: snapshot.index,
      typing: typingWithCursor(term.typingText, snapshot.cursor),
    },
    quiz: null,
  };
}
