import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenShake } from "../types/game";

/** 画面揺れの長さ（docs/spec.md §9.1: 誤入力 120ms） */
export const SHAKE_DURATION_MS = 120;

export type ShakeLevel = Exclude<ScreenShake, "none">;

export interface UseScreenShakeResult {
  /** 揺れを開始する（設定 none / reduced-motion では何もしない） */
  shake(): void;
  /** コンテナに `data-shake` として付与する値。揺れていないときは undefined */
  shakeAttr: ShakeLevel | undefined;
}

/** 誤入力時の画面揺れ（§5.2, §4.5）。transform のみを使う CSS アニメーションを 120ms 付与する */
export function useScreenShake(setting: ScreenShake, reducedMotion = false): UseScreenShakeResult {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = setting !== "none" && !reducedMotion;

  const shake = useCallback(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    setActive(true);
    timer.current = setTimeout(() => {
      setActive(false);
      timer.current = null;
    }, SHAKE_DURATION_MS);
  }, [enabled]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { shake, shakeAttr: enabled && active ? (setting as ShakeLevel) : undefined };
}
