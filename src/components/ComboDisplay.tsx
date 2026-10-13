import { memo } from "react";

export interface ComboDisplayProps {
  combo: number;
  fever: boolean;
  /** 数字変化時のスケール（150ms）を行うか。reduced-motion で false */
  animate?: boolean;
}

/** COMBO 表示（docs/spec.md §4.2, §6.4, §9.1）。数字の変化で 150ms スケール、FEVER 中は拡大・発光 */
export const ComboDisplay = memo(function ComboDisplay({
  combo,
  fever,
  animate = true,
}: ComboDisplayProps) {
  return (
    <div
      className="flex flex-col items-center"
      data-testid="combo-display"
      data-fever={fever ? "true" : "false"}
    >
      <div className={`text-xs tracking-widest ${fever ? "text-fever" : "text-subtext"}`}>
        {fever ? "FEVER" : "COMBO"}
      </div>
      <div
        // key を combo にすることで数字が変わるたびにアニメーションを再始動する
        key={combo}
        className={`fx-combo text-3xl font-bold tabular-nums ${fever ? "text-fever" : combo > 0 ? "text-perfect" : "text-subtext"}`}
        data-testid="combo-value"
        data-fever={fever ? "true" : "false"}
        data-animate={animate && combo > 0 ? "scale" : "none"}
      >
        {combo}
      </div>
    </div>
  );
});
