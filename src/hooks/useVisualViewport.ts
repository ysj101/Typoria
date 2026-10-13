import { useEffect, useState } from "react";

/** この高さ以下はゲーム画面を縮小レイアウトにする（横持ち・ソフトキーボード） */
export const COMPACT_VIEWPORT_HEIGHT = 520;

function readViewport(): { height: number; top: number } {
  if (typeof window === "undefined") return { height: 800, top: 0 };
  const vv = window.visualViewport;
  return {
    height: vv?.height ?? window.innerHeight,
    top: vv?.offsetTop ?? 0,
  };
}

/**
 * ゲーム画面の高さを `visualViewport` に合わせる。
 * ソフトキーボード表示中は layout viewport が縮まないブラウザ（iOS Chrome）でも、
 * 問題文・HUD・コンボを可視領域へ収める。
 */
export function useVisualViewport(): { compact: boolean } {
  const [compact, setCompact] = useState(() => readViewport().height <= COMPACT_VIEWPORT_HEIGHT);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const { height, top } = readViewport();
      root.style.setProperty("--vvh", `${Math.round(height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(top)}px`);
      setCompact(height <= COMPACT_VIEWPORT_HEIGHT);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vv-top");
    };
  }, []);

  return { compact };
}
