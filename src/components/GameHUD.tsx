import { memo } from "react";
import { GAME_DURATION_MS } from "../types/game";
import { ComboDisplay } from "./ComboDisplay";
import { formatTime } from "../game/format";

export interface GameHUDProps {
  score: number;
  remainingMs: number;
  combo: number;
  fever: boolean;
}

/** HUD: SCORE / TIME / 進捗バー / COMBO（docs/spec.md §4.2） */
export const GameHUD = memo(function GameHUD({ score, remainingMs, combo, fever }: GameHUDProps) {
  const ratio = Math.max(0, Math.min(1, remainingMs / GAME_DURATION_MS));
  return (
    <header className="flex w-full flex-col gap-2" aria-label="ゲーム状況">
      <div className="flex items-end justify-between gap-4 tabular-nums">
        <div>
          <div className="text-xs tracking-widest text-subtext">SCORE</div>
          <div className="text-3xl font-bold" data-testid="hud-score">
            {score.toLocaleString()}
          </div>
        </div>
        <ComboDisplay combo={combo} fever={fever} />
        <div className="text-right">
          <div className="text-xs tracking-widest text-subtext">TIME</div>
          <div className="text-3xl font-bold" data-testid="hud-time">
            {formatTime(remainingMs)}
          </div>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="残り時間"
        aria-valuemin={0}
        aria-valuemax={GAME_DURATION_MS}
        aria-valuenow={Math.round(remainingMs)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-bg-gradient"
      >
        <div
          className={`h-full rounded-full ${fever ? "bg-fever" : "bg-perfect"}`}
          style={{ width: `${ratio * 100}%`, transition: "width 100ms linear" }}
        />
      </div>
    </header>
  );
});
