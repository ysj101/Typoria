import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createEngine, type EngineSnapshot, type GameEngine } from "../game/engine";
import { createQuestionPicker } from "../game/questions";
import type { Difficulty, Question } from "../types/game";

export interface UseGameOptions {
  difficulty: Difficulty;
  questions: Question[];
  weakQuestionIds?: string[];
  /** テスト用にエンジンを差し替える */
  createGameEngine?: (opts: {
    difficulty: Difficulty;
    questions: Question[];
    weakQuestionIds: string[];
  }) => GameEngine;
}

export interface UseGameResult {
  engine: GameEngine;
  snapshot: EngineSnapshot;
}

function defaultCreateEngine({
  difficulty,
  questions,
  weakQuestionIds,
}: {
  difficulty: Difficulty;
  questions: Question[];
  weakQuestionIds: string[];
}): GameEngine {
  const picker = createQuestionPicker({ questions, difficulty, weakQuestionIds });
  return createEngine({ picker, difficulty });
}

/**
 * エンジン（#16）を React に接続する（docs/spec.md §13.2, §18.1）。
 * `useSyncExternalStore` で購読し、COUNTDOWN / PLAYING の間は requestAnimationFrame で `tick` する。
 * エンジンは初回レンダリング時に 1 度だけ生成する。
 */
export function useGame({
  difficulty,
  questions,
  weakQuestionIds,
  createGameEngine = defaultCreateEngine,
}: UseGameOptions): UseGameResult {
  const [engine] = useState<GameEngine>(() =>
    createGameEngine({ difficulty, questions, weakQuestionIds: weakQuestionIds ?? [] }),
  );

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const running = snapshot.state === "COUNTDOWN" || snapshot.state === "PLAYING";

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const loop = () => {
      engine.tick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine, running]);

  return useMemo(() => ({ engine, snapshot }), [engine, snapshot]);
}
