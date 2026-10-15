import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { isLearnRoundResult, type LearnRoundResult } from "../game/learnQuiz";
import type { DailyMissionId, Difficulty, GameSession } from "../types/game";
import { isTermCategory, type TermCategory } from "../types/term";

/** ルートパス（docs/spec.md §4 画面構成） */
export const ROUTES = {
  home: "/",
  game: "/game",
  learn: "/learn",
  learnRound: "/learn/round",
  glossary: "/glossary",
  result: "/result",
  history: "/history",
  settings: "/settings",
} as const;

/** 学習ラウンドの始め方。カテゴリ指定か、未学習・学習中を優先するおまかせ */
export type LearnRoundStart = { mode: "omakase" } | { mode: "category"; category: TermCategory };

export function readLearnRoundStart(state: unknown): LearnRoundStart {
  if (!state || typeof state !== "object") return { mode: "omakase" };
  const record = state as Record<string, unknown>;
  if (record.mode === "category" && isTermCategory(record.category)) {
    return { mode: "category", category: record.category };
  }
  return { mode: "omakase" };
}

/** Result 画面に渡す付帯情報（#17 の戻り値に対応） */
export interface ResultPayload {
  session: GameSession;
  isNewRecord: boolean;
  missionRewards: { id: DailyMissionId; rewardXP: number }[];
  nextDifficulty: Difficulty;
  streak: number;
}

/** 画面遷移のラッパ。Home → Game、Game → Result、Result → Home / Game */
export function useAppNavigate() {
  const navigate = useNavigate();
  const toHome = useCallback(() => navigate(ROUTES.home), [navigate]);
  const toGame = useCallback(() => navigate(ROUTES.game), [navigate]);
  const toLearn = useCallback(() => navigate(ROUTES.learn), [navigate]);
  const toLearnRound = useCallback(
    (start: LearnRoundStart) => navigate(ROUTES.learnRound, { state: start }),
    [navigate],
  );
  const toGlossary = useCallback(() => navigate(ROUTES.glossary), [navigate]);
  const toResult = useCallback(
    (payload: ResultPayload) => navigate(ROUTES.result, { state: payload, replace: true }),
    [navigate],
  );
  const toLearnResult = useCallback(
    (result: LearnRoundResult) => navigate(ROUTES.result, { state: result, replace: true }),
    [navigate],
  );
  const toHistory = useCallback(() => navigate(ROUTES.history), [navigate]);
  const toSettings = useCallback(() => navigate(ROUTES.settings), [navigate]);
  return useMemo(
    () => ({
      toHome,
      toGame,
      toLearn,
      toLearnRound,
      toGlossary,
      toResult,
      toLearnResult,
      toHistory,
      toSettings,
    }),
    [
      toHome,
      toGame,
      toLearn,
      toLearnRound,
      toGlossary,
      toResult,
      toLearnResult,
      toHistory,
      toSettings,
    ],
  );
}

function isResultPayload(value: unknown): value is ResultPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.session === "object" && v.session !== null && typeof v.isNewRecord === "boolean";
}

/** Result 画面で route state から結果を取り出す。直接アクセス時は null */
export function useResultPayload(): ResultPayload | null {
  const location = useLocation();
  return isResultPayload(location.state) ? location.state : null;
}

/** 学習ラウンドの結果。90 秒モードの payload とは別 */
export function useLearnResult(): LearnRoundResult | null {
  const location = useLocation();
  return isLearnRoundResult(location.state) ? location.state : null;
}

/** 学習ラウンドの始め方を route state から読む。直接アクセス時はおまかせ */
export function useLearnRoundStart(): LearnRoundStart {
  return readLearnRoundStart(useLocation().state);
}
