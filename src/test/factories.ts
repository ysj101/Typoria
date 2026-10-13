import type { GameSession, QuestionResult } from "../types/game";

/** テスト用の QuestionResult ファクトリ */
export function makeQuestionResult(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    questionId: "easy-001",
    status: "solved",
    durationMs: 3_000,
    correctKeystrokes: 5,
    incorrectKeystrokes: 0,
    perfect: true,
    ...overrides,
  };
}

/** テスト用の GameSession ファクトリ */
export function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: "session-1",
    startedAt: "2026-10-13T10:00:00.000Z",
    completedAt: "2026-10-13T10:01:33.000Z",
    difficulty: "normal",
    score: 0,
    maxCombo: 0,
    solved: 0,
    skipped: 0,
    perfectSolved: 0,
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
    xpEarned: 0,
    results: [],
    ...overrides,
  };
}
