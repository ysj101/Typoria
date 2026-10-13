import { memo } from "react";
import type { CSSProperties } from "react";

/** 同時に存在できる粒子数の上限（§9.1: 粒子数に上限） */
export const PARTICLE_LIMIT = 60;
/** 1 粒子の寿命 */
export const PARTICLE_LIFETIME_MS = 600;

export interface Particle {
  id: number;
  /** 発生位置（% 0〜100） */
  x: number;
  y: number;
  /** 飛散方向の変位（px） */
  dx: number;
  dy: number;
  size: number;
  color: "correct" | "perfect" | "fever";
}

export interface ParticleEffectProps {
  particles: Particle[];
}

const COLOR_CLASS: Record<Particle["color"], string> = {
  correct: "bg-correct",
  perfect: "bg-perfect",
  fever: "bg-fever",
};

/** パーティクル（§9.1）。transform / opacity のみをアニメーションする。設定 OFF 時は呼び出し側で描画しない */
export const ParticleEffect = memo(function ParticleEffect({ particles }: ParticleEffectProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-testid="particles"
      data-count={particles.length}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          data-testid="particle"
          className={`fx-particle absolute rounded-full ${COLOR_CLASS[p.color]}`}
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--fx-dx": `${p.dx}px`,
              "--fx-dy": `${p.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
});
