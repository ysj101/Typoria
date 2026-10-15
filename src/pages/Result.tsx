import { Navigate } from "react-router";
import { ROUTES, useAppNavigate, useLearnResult, useResultPayload } from "../app/navigation";
import { LearnResultView } from "../components/LearnResultView";
import { ResultView } from "../components/ResultView";

/**
 * リザルト画面。
 * 90 秒モードは docs/spec.md §4.3。学習モードは今日学んだ用語とクイズの正誤。
 * route state が無い直接アクセスはホームへ戻す。
 */
export function Result() {
  const learn = useLearnResult();
  const payload = useResultPayload();
  const nav = useAppNavigate();
  if (learn) {
    return <LearnResultView result={learn} onAgain={nav.toLearn} onHome={nav.toHome} />;
  }
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
