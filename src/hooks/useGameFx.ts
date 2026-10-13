import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BackgroundState } from "../app/backgroundState";
import { useBackgroundControl } from "../app/useBackgroundControl";
import { PARTICLE_LIFETIME_MS, PARTICLE_LIMIT, type Particle } from "../components/ParticleEffect";
import { SCORE_POPUP_LIMIT, SCORE_POPUP_MS, type ScorePopupItem } from "../components/ScorePopup";
import type { EngineSnapshot, GameEngine } from "../game/engine";
import { FEVER_COMBO, type Question, type ScreenShake } from "../types/game";
import { useScreenShake, type ShakeLevel } from "./useScreenShake";

/** 問題クリア時のフェードアウト（§9.1: 150ms） */
export const GHOST_MS = 150;
/** FEVER 中に常時出す粒子の間隔 */
export const FEVER_PARTICLE_INTERVAL_MS = 300;

export interface GhostQuestion {
  id: number;
  question: Question;
}

export interface UseGameFxOptions {
  settings: { screenShake: ScreenShake; particles: boolean };
  reducedMotion: boolean;
  /** 発生位置などに使う乱数。既定は Math.random */
  rng?: () => number;
}

export interface GameFx {
  popups: ScorePopupItem[];
  particles: Particle[];
  /** クリアした直前の問題（150ms フェードアウト用） */
  ghost: GhostQuestion | null;
  shakeAttr: ShakeLevel | undefined;
  /** 文字アニメーションを再始動させるためのキー（correct / incorrect ごとに増える） */
  charAnimKey: number;
  /** アニメーションを行うか（reduced-motion で false） */
  animate: boolean;
}

/** コンボ数から背景状態を決める（§4.2: コンボに応じて変化、§6.4: FEVER） */
export function backgroundForCombo(combo: number, fever: boolean): BackgroundState {
  if (fever) return { mode: "fever", intensity: 1 };
  if (combo <= 0) return { mode: "normal", intensity: 0 };
  return { mode: "combo", intensity: Math.min(1, combo / FEVER_COMBO) };
}

/**
 * ゲーム演出（docs/spec.md §9.1, §18.3）。engine のイベントを購読して
 * ポップアップ・パーティクル・画面揺れ・背景を制御する。演出はゲーム進行をブロックしない。
 */
export function useGameFx(
  engine: GameEngine,
  snapshot: EngineSnapshot,
  { settings, reducedMotion, rng = Math.random }: UseGameFxOptions,
): GameFx {
  const animate = !reducedMotion;
  const particlesEnabled = settings.particles && animate;
  const { shake, shakeAttr } = useScreenShake(settings.screenShake, reducedMotion);
  const [popups, setPopups] = useState<ScorePopupItem[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [ghost, setGhost] = useState<GhostQuestion | null>(null);
  const [charAnimKey, setCharAnimKey] = useState(0);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const optsRef = useRef({ particlesEnabled, animate, rng, shake });
  useLayoutEffect(() => {
    optsRef.current = { particlesEnabled, animate, rng, shake };
  });

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);

  const spawnParticles = useCallback(
    (count: number, color: Particle["color"], origin: { x: number; y: number }) => {
      if (!optsRef.current.particlesEnabled || count <= 0) return;
      const r = optsRef.current.rng;
      const created: Particle[] = Array.from({ length: count }, () => {
        const angle = r() * Math.PI * 2;
        const dist = 40 + r() * 120;
        return {
          id: ++seq.current,
          x: origin.x + (r() - 0.5) * 20,
          y: origin.y + (r() - 0.5) * 10,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 40,
          size: 4 + r() * 6,
          color,
        };
      });
      setParticles((prev) => [...prev, ...created].slice(-PARTICLE_LIMIT));
      const ids = new Set(created.map((p) => p.id));
      schedule(
        () => setParticles((prev) => prev.filter((p) => !ids.has(p.id))),
        PARTICLE_LIFETIME_MS,
      );
    },
    [schedule],
  );

  // エンジンイベントの購読
  useEffect(() => {
    let previousQuestion = engine.getSnapshot().question;
    const unsubscribe = engine.onEvent((event) => {
      const { animate: anim, shake: doShake } = optsRef.current;
      switch (event.type) {
        case "correct":
          if (anim) setCharAnimKey((k) => k + 1);
          break;
        case "incorrect":
          if (anim) setCharAnimKey((k) => k + 1);
          doShake();
          break;
        case "clear": {
          const id = ++seq.current;
          setPopups((prev) =>
            [...prev, { id, score: event.score, perfect: event.perfect }].slice(-SCORE_POPUP_LIMIT),
          );
          schedule(() => setPopups((prev) => prev.filter((p) => p.id !== id)), SCORE_POPUP_MS);
          if (anim && previousQuestion) {
            const ghostId = ++seq.current;
            const question = previousQuestion;
            setGhost({ id: ghostId, question });
            schedule(() => setGhost((g) => (g?.id === ghostId ? null : g)), GHOST_MS);
          }
          spawnParticles(event.perfect ? 18 : 8, event.perfect ? "perfect" : "correct", {
            x: 50,
            y: 50,
          });
          break;
        }
        case "fever_start":
          spawnParticles(30, "fever", { x: 50, y: 50 });
          break;
        default:
          break;
      }
      previousQuestion = engine.getSnapshot().question;
    });
    return unsubscribe;
  }, [engine, schedule, spawnParticles]);

  // FEVER 中は少量の粒子を常時出す
  const fever = snapshot.fever && snapshot.state === "PLAYING";
  useEffect(() => {
    if (!fever || !particlesEnabled) return;
    const interval = setInterval(() => {
      spawnParticles(2, "fever", { x: optsRef.current.rng() * 100, y: 100 });
    }, FEVER_PARTICLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fever, particlesEnabled, spawnParticles]);

  // 背景（§4.2: コンボに応じて変化、§6.4: FEVER）
  const { setBackground } = useBackgroundControl();
  const bg = useMemo(
    () => backgroundForCombo(snapshot.combo, snapshot.fever),
    [snapshot.combo, snapshot.fever],
  );
  useEffect(() => {
    setBackground(bg);
  }, [bg, setBackground]);
  useEffect(() => () => setBackground({ mode: "normal", intensity: 0 }), [setBackground]);

  // タイマーの後始末
  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) clearTimeout(t);
      set.clear();
    };
  }, []);

  return useMemo(
    () => ({
      popups,
      particles: particlesEnabled ? particles : [],
      ghost: animate ? ghost : null,
      shakeAttr,
      charAnimKey,
      animate,
    }),
    [popups, particles, particlesEnabled, ghost, animate, shakeAttr, charAnimKey],
  );
}
