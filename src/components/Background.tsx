import { useMemo } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "./Background.css";

/**
 * 夜空・星・グラデーションの全画面背景（docs/spec.md §10.2, §4.2, §6.4）。
 * `mode` と `intensity` で演出段階を切り替える。
 */

export type BackgroundMode = "normal" | "combo" | "fever";

export interface BackgroundProps {
  /** 演出段階。combo はコンボ中、fever は FEVER 中 */
  mode?: BackgroundMode;
  /** 0〜1。コンボの盛り上がり度合い。範囲外はクランプする */
  intensity?: number;
  /** アプリ設定による演出軽減（OS 設定とは OR） */
  reducedMotion?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

/** mulberry32: テストで安定するよう決定的な疑似乱数を使う */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 80;
const STAR_SEED = 0x7f0b1a26;

function generateStars(count: number, seed: number): Star[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => ({
    x: rng() * 100,
    y: rng() * 100,
    size: 1 + rng() * 2,
    delay: rng() * 4,
    duration: 2 + rng() * 3,
    opacity: 0.3 + rng() * 0.7,
  }));
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function Background({ mode = "normal", intensity = 0, reducedMotion }: BackgroundProps) {
  const reduced = useReducedMotion(reducedMotion);
  const stars = useMemo(() => generateStars(STAR_COUNT, STAR_SEED), []);
  const level = clamp01(intensity);

  return (
    <div
      className="typoria-background"
      data-mode={mode}
      data-intensity={String(level)}
      data-reduced-motion={reduced ? "true" : "false"}
      aria-hidden="true"
      style={{ "--bg-intensity": level } as React.CSSProperties}
    >
      <div className="typoria-background__glow" />
      <div className="typoria-background__stars">
        {stars.map((star, i) => (
          <span
            key={i}
            data-star="true"
            className="typoria-background__star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>
    </div>
  );
}
