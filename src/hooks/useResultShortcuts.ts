import { useEffect } from "react";

/**
 * リザルト画面のキーボード操作。Enter で主操作（もう一度）、Esc でホームへ（AC-18）。
 * ボタンにフォーカスがあるときの Enter は、そのボタンの click に任せて二重発火を防ぐ。
 */
export function useResultShortcuts(onPrimary: () => void, onHome: () => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        if (event.target instanceof Element && event.target.closest("button")) return;
        event.preventDefault();
        onPrimary();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onHome();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrimary, onHome]);
}
