import { useSyncExternalStore } from "react";

/**
 * reduced-motion 判定（docs/spec.md §4.5）。
 * OS の `prefers-reduced-motion` とアプリ設定の両方を見る。
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(QUERY);
}

/** OS 設定が reduced-motion を要求しているか。`matchMedia` がない環境では false */
export function prefersReducedMotion(): boolean {
  return getMediaQuery()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const mql = getMediaQuery();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * OS 設定（購読して追従）とアプリ設定（`appSetting === true` で強制軽減）の OR を返す。
 */
export function useReducedMotion(appSetting = false): boolean {
  const osPrefers = useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
  return appSetting || osPrefers;
}
