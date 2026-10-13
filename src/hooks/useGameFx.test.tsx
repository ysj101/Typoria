import { act, renderHook } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundProvider } from "../app/BackgroundContext";
import { useBackgroundControl } from "../app/useBackgroundControl";
import { PARTICLE_LIFETIME_MS, PARTICLE_LIMIT } from "../components/ParticleEffect";
import { SCORE_POPUP_MS } from "../components/ScorePopup";
import { createEngine, type GameEngine } from "../game/engine";
import { createQuestionPicker, createSeededRng } from "../game/questions";
import { COUNTDOWN_MS, type Question, type ScreenShake } from "../types/game";
import { backgroundForCombo, GHOST_MS, useGameFx } from "./useGameFx";

const QUESTIONS: Question[] = Array.from({ length: 12 }, (_, i) => ({
  id: `easy-${String(i + 1).padStart(3, "0")}`,
  type: "word",
  difficulty: "easy",
  japanese: `単語${i}`,
  english: "ab",
  answer: "ab",
  tags: ["noun"],
}));

function setupEngine() {
  let t = 0;
  const engine = createEngine({
    picker: createQuestionPicker({
      questions: QUESTIONS,
      difficulty: "easy",
      rng: createSeededRng(1),
    }),
    difficulty: "easy",
    now: () => t,
    generateId: () => "s",
  });
  engine.start();
  t += COUNTDOWN_MS;
  engine.tick();
  return engine;
}

function clear(engine: GameEngine) {
  engine.input("a");
  engine.input("b");
}

function wrapper({ children }: { children: ReactNode }) {
  return <BackgroundProvider>{children}</BackgroundProvider>;
}

function renderFx(
  engine: GameEngine,
  opts: { screenShake?: ScreenShake; particles?: boolean; reducedMotion?: boolean } = {},
) {
  return renderHook(
    () => {
      const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
      const fx = useGameFx(engine, snapshot, {
        settings: { screenShake: opts.screenShake ?? "weak", particles: opts.particles ?? true },
        reducedMotion: opts.reducedMotion ?? false,
        rng: createSeededRng(3),
      });
      const { background } = useBackgroundControl();
      return { fx, background };
    },
    { wrapper },
  );
}

describe("backgroundForCombo (§4.2, §6.4)", () => {
  it("maps combo to background mode and intensity", () => {
    expect(backgroundForCombo(0, false)).toEqual({ mode: "normal", intensity: 0 });
    expect(backgroundForCombo(5, false)).toEqual({ mode: "combo", intensity: 0.5 });
    expect(backgroundForCombo(10, true)).toEqual({ mode: "fever", intensity: 1 });
  });
});

describe("useGameFx (§9.1, §18.3)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a score popup for 300ms on clear", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine);
    act(() => clear(engine));
    expect(result.current.fx.popups).toEqual([
      { id: expect.any(Number), score: 130, perfect: true },
    ]);
    act(() => vi.advanceTimersByTime(SCORE_POPUP_MS));
    expect(result.current.fx.popups).toEqual([]);
  });

  it("keeps a ghost of the cleared question for 150ms", () => {
    const engine = setupEngine();
    const firstId = engine.getSnapshot().question!.id;
    const { result } = renderFx(engine);
    act(() => clear(engine));
    expect(result.current.fx.ghost?.question.id).toBe(firstId);
    act(() => vi.advanceTimersByTime(GHOST_MS));
    expect(result.current.fx.ghost).toBeNull();
  });

  it("spawns particles on clear and removes them after their lifetime", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine);
    act(() => clear(engine));
    expect(result.current.fx.particles.length).toBe(18);
    act(() => vi.advanceTimersByTime(PARTICLE_LIFETIME_MS));
    expect(result.current.fx.particles).toEqual([]);
  });

  it("never exceeds the particle cap", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine);
    act(() => {
      for (let i = 0; i < 10; i += 1) clear(engine);
    });
    expect(result.current.fx.particles.length).toBeLessThanOrEqual(PARTICLE_LIMIT);
  });

  it("does not spawn particles when disabled", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine, { particles: false });
    act(() => clear(engine));
    expect(result.current.fx.particles).toEqual([]);
  });

  it("shakes the screen on incorrect input and bumps the char animation key", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine, { screenShake: "strong" });
    act(() => engine.input("z"));
    expect(result.current.fx.shakeAttr).toBe("strong");
    expect(result.current.fx.charAnimKey).toBe(1);
    act(() => engine.input("a"));
    expect(result.current.fx.charAnimKey).toBe(2);
  });

  it("does not shake when the setting is none", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine, { screenShake: "none" });
    act(() => engine.input("z"));
    expect(result.current.fx.shakeAttr).toBeUndefined();
  });

  it("drives the background from combo and FEVER", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine);
    expect(result.current.background).toEqual({ mode: "normal", intensity: 0 });
    act(() => clear(engine));
    expect(result.current.background).toEqual({ mode: "combo", intensity: 0.1 });
    act(() => {
      for (let i = 0; i < 9; i += 1) clear(engine);
    });
    expect(result.current.background).toEqual({ mode: "fever", intensity: 1 });
    act(() => engine.skip());
    expect(result.current.background).toEqual({ mode: "normal", intensity: 0 });
  });

  it("resets the background to normal on unmount", () => {
    const engine = setupEngine();
    const { result, unmount } = renderFx(engine);
    act(() => clear(engine));
    expect(result.current.background.mode).toBe("combo");
    unmount();
    // Provider 自体もアンマウントされるため、別の購読者で確認する
    const probe = renderHook(() => useBackgroundControl(), { wrapper });
    expect(probe.result.current.background.mode).toBe("normal");
  });

  it("disables animations under reduced motion", () => {
    const engine = setupEngine();
    const { result } = renderFx(engine, { reducedMotion: true, screenShake: "strong" });
    act(() => engine.input("z"));
    act(() => clear(engine));
    expect(result.current.fx.animate).toBe(false);
    expect(result.current.fx.shakeAttr).toBeUndefined();
    expect(result.current.fx.charAnimKey).toBe(0);
    expect(result.current.fx.ghost).toBeNull();
    expect(result.current.fx.particles).toEqual([]);
    // ポップアップは即時表示（アニメーションなし）で残す
    expect(result.current.fx.popups).toHaveLength(1);
  });
});
