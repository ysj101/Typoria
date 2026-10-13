import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import type { DailyMissionId, Difficulty, GameSession } from "../types/game";

/** ルートパス（docs/spec.md §4 画面構成） */
export const ROUTES = {
  home: "/",
  game: "/game",
  result: "/result",
  history: "/history",
  settings: "/settings",
} as const;

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
  const toResult = useCallback(
    (payload: ResultPayload) => navigate(ROUTES.result, { state: payload, replace: true }),
    [navigate],
  );
  const toHistory = useCallback(() => navigate(ROUTES.history), [navigate]);
  const toSettings = useCallback(() => navigate(ROUTES.settings), [navigate]);
  return useMemo(
    () => ({ toHome, toGame, toResult, toHistory, toSettings }),
    [toHome, toGame, toResult, toHistory, toSettings],
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
