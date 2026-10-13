import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "../game/audio";
import { createEngine, type GameEngine } from "../game/engine";
import { createQuestionPicker, createSeededRng } from "../game/questions";
import { COUNTDOWN_MS, DEFAULT_SETTINGS, type Question } from "../types/game";
import { useGameAudio } from "./useGameAudio";

const QUESTIONS: Question[] = Array.from({ length: 30 }, (_, i) => ({
  id: `easy-${String(i + 1).padStart(3, "0")}`,
  type: "word",
  difficulty: "easy",
  japanese: "単語",
  english: "ab",
  answer: "ab",
  tags: ["noun"],
}));

function createMockAudio(): AudioEngine {
  return {
    unlock: vi.fn(async () => {}),
    isUnlocked: vi.fn(() => true),
    play: vi.fn(),
    startBgm: vi.fn(),
    stopBgm: vi.fn(),
    setFeverLayer: vi.fn(),
    setVolume: vi.fn(),
    setEnabled: vi.fn(),
    applySettings: vi.fn(),
    dispose: vi.fn(),
  };
}

function setup() {
  let t = 0;
  const engine = createEngine({
    picker: createQuestionPicker({
      questions: QUESTIONS,
      difficulty: "easy",
      rng: createSeededRng(3),
    }),
    difficulty: "easy",
    now: () => t,
  });
  const audio = createMockAudio();
  const hook = renderHook(() => useGameAudio(engine, DEFAULT_SETTINGS, audio));
  const startPlaying = () => {
    engine.start();
    t += COUNTDOWN_MS;
    engine.tick();
  };
  const clear = (e: GameEngine = engine) => {
    for (const ch of e.getSnapshot().question!.answer) e.input(ch);
  };
  return { engine, audio, hook, startPlaying, clear };
}

function playCalls(audio: AudioEngine) {
  return (audio.play as ReturnType<typeof vi.fn>).mock.calls;
}

describe("useGameAudio (§9.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies settings through useAudio", () => {
    const { audio } = setup();
    expect(audio.applySettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it("starts BGM when the game starts and plays key / miss on input", () => {
    const { engine, audio, startPlaying } = setup();
    startPlaying();
    expect(audio.startBgm).toHaveBeenCalledTimes(1);
    engine.input("z");
    expect(audio.play).toHaveBeenLastCalledWith("miss");
    engine.input("a");
    expect(audio.play).toHaveBeenLastCalledWith("key");
  });

  it("plays perfect on a perfect clear and clear otherwise", () => {
    const { engine, audio, startPlaying, clear } = setup();
    startPlaying();
    clear();
    expect(audio.play).toHaveBeenCalledWith("perfect");
    engine.input("z");
    clear();
    expect(audio.play).toHaveBeenCalledWith("clear");
  });

  it("plays combo only at 5, 10 and 20 and fever at 10", () => {
    const { audio, startPlaying, clear } = setup();
    startPlaying();
    for (let i = 0; i < 20; i += 1) clear();
    const combos = playCalls(audio).filter((c) => c[0] === "combo");
    expect(combos.map((c) => c[1])).toEqual([{ combo: 5 }, { combo: 10 }, { combo: 20 }]);
    expect(audio.play).toHaveBeenCalledWith("fever");
    expect(audio.setFeverLayer).toHaveBeenCalledWith(true);
  });

  it("turns the fever layer off when the combo resets", () => {
    const { engine, audio, startPlaying, clear } = setup();
    startPlaying();
    for (let i = 0; i < 10; i += 1) clear();
    engine.skip();
    expect(audio.setFeverLayer).toHaveBeenLastCalledWith(false);
  });

  it("stops BGM on pause and restarts on resume", () => {
    const { engine, audio, startPlaying } = setup();
    startPlaying();
    engine.pause();
    expect(audio.stopBgm).toHaveBeenCalledTimes(1);
    engine.resume();
    expect(audio.startBgm).toHaveBeenCalledTimes(2);
  });

  it("stops BGM and plays result on finish", () => {
    const { engine, audio, startPlaying } = setup();
    startPlaying();
    engine.abort();
    expect(audio.stopBgm).toHaveBeenCalled();
    expect(audio.setFeverLayer).toHaveBeenLastCalledWith(false);
    expect(audio.play).toHaveBeenLastCalledWith("result");
  });

  it("unsubscribes and stops BGM on unmount", () => {
    const { engine, audio, hook, startPlaying } = setup();
    startPlaying();
    hook.unmount();
    expect(audio.stopBgm).toHaveBeenCalled();
    (audio.play as ReturnType<typeof vi.fn>).mockClear();
    engine.input("a");
    expect(audio.play).not.toHaveBeenCalled();
  });
});
