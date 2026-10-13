import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BackgroundContext,
  DEFAULT_BACKGROUND,
  type BackgroundContextValue,
  type BackgroundState,
} from "./backgroundState";

/** 背景演出（§4.2, §6.4）の mode / intensity を画面から制御するためのプロバイダ */
export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [background, setState] = useState<BackgroundState>(DEFAULT_BACKGROUND);
  const setBackground = useCallback((next: BackgroundState) => {
    setState((prev) =>
      prev.mode === next.mode && prev.intensity === next.intensity ? prev : next,
    );
  }, []);
  const value = useMemo<BackgroundContextValue>(
    () => ({ background, setBackground }),
    [background, setBackground],
  );
  return <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>;
}
