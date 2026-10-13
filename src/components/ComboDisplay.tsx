import { memo } from "react";

export interface ComboDisplayProps {
  combo: number;
  fever: boolean;
}

/** COMBO 表示（docs/spec.md §4.2, §6.4）。アニメーションは #23 で追加 */
export const ComboDisplay = memo(function ComboDisplay({ combo, fever }: ComboDisplayProps) {
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
        className={`text-3xl font-bold tabular-nums ${fever ? "text-fever" : combo > 0 ? "text-perfect" : "text-subtext"}`}
        data-testid="combo-value"
      >
        {combo}
      </div>
    </div>
  );
});
