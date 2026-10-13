import { Navigate } from "react-router";
import { ROUTES, useAppNavigate, useResultPayload } from "../app/navigation";
import { ResultView } from "../components/ResultView";

/** リザルト画面（docs/spec.md §4.3）。route state が無い直接アクセスはホームへ戻す */
export function Result() {
  const payload = useResultPayload();
  const nav = useAppNavigate();
  if (!payload) return <Navigate to={ROUTES.home} replace />;
  return (
    <ResultView
      session={payload.session}
      isNewRecord={payload.isNewRecord}
      missionRewards={payload.missionRewards ?? []}
      nextDifficulty={payload.nextDifficulty}
      streak={payload.streak}
      onPlayAgain={nav.toGame}
      onBackHome={nav.toHome}
    />
  );
}
