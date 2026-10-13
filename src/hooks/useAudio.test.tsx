import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../types/game";
import type { AudioEngine } from "../game/audio";
import { useAudio } from "./useAudio";

function mockEngine(): AudioEngine {
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

describe("useAudio", () => {
  it("applies settings on mount and whenever they change", () => {
    const engine = mockEngine();
    const { rerender } = renderHook(({ s }) => useAudio(s, engine), {
      initialProps: { s: DEFAULT_SETTINGS },
    });
    expect(engine.applySettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    const next = { ...DEFAULT_SETTINGS, sfxEnabled: false };
    rerender({ s: next });
    expect(engine.applySettings).toHaveBeenLastCalledWith(next);
    expect(engine.applySettings).toHaveBeenCalledTimes(2);
  });

  it("returns a stable engine reference", () => {
    const engine = mockEngine();
    const { result, rerender } = renderHook(({ s }) => useAudio(s, engine), {
      initialProps: { s: DEFAULT_SETTINGS },
    });
    const first = result.current;
    rerender({ s: { ...DEFAULT_SETTINGS, sfxVolume: 10 } });
    expect(result.current).toBe(first);
    expect(first).toBe(engine);
  });

  it("falls back to the shared engine when none is given", () => {
    const { result, rerender } = renderHook(({ s }) => useAudio(s), {
      initialProps: { s: DEFAULT_SETTINGS },
    });
    const first = result.current;
    expect(typeof first.play).toBe("function");
    rerender({ s: { ...DEFAULT_SETTINGS, bgmEnabled: false } });
    expect(result.current).toBe(first);
    expect(() => first.play("key")).not.toThrow();
  });
});
