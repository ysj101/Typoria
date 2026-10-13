import { memo } from "react";

/** ScorePopup の表示時間（docs/spec.md §9.1: 300ms） */
export const SCORE_POPUP_MS = 300;
/** 同時表示の上限 */
export const SCORE_POPUP_LIMIT = 5;

export interface ScorePopupItem {
  id: number;
  score: number;
  perfect: boolean;
}

export interface ScorePopupLayerProps {
  popups: ScorePopupItem[];
  animate?: boolean;
}

/** `+250` / `PERFECT!` のポップアップ（§9.1）。入力対象の上に重ならないよう、問題エリアの上部に表示する */
export const ScorePopupLayer = memo(function ScorePopupLayer({
  popups,
  animate = true,
}: ScorePopupLayerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 -top-14 flex h-12 flex-col items-center justify-end"
      aria-hidden="true"
      data-testid="score-popups"
    >
      {popups.map((p) => (
        <div
          key={p.id}
          data-testid="score-popup"
          data-perfect={p.perfect ? "true" : "false"}
          data-animate={animate ? "rise" : "none"}
          className={`fx-score-popup absolute text-2xl font-bold tabular-nums ${p.perfect ? "text-perfect" : "text-correct"}`}
        >
          +{p.score}
          {p.perfect && <span className="ml-2 text-lg tracking-widest">PERFECT!</span>}
        </div>
      ))}
    </div>
  );
});
