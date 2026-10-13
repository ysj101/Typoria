import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../types/game";
import { createFakeContextFactory, type FakeAudioContext } from "../test/fakeAudioContext";
import { comboFrequency, createAudioEngine, volumeToGain, type AudioEngine } from "./audio";

describe("volumeToGain", () => {
  it("maps 0..100 to 0..1 with a perceptual curve", () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(50)).toBeCloseTo(0.25);
    expect(volumeToGain(150)).toBe(1);
    expect(volumeToGain(-5)).toBe(0);
  });
});

describe("comboFrequency", () => {
  it("rises with combo and caps at 40", () => {
    expect(comboFrequency(0)).toBeCloseTo(440);
    expect(comboFrequency(12)).toBeCloseTo(880);
    expect(comboFrequency(5)).toBeGreaterThan(comboFrequency(1));
    expect(comboFrequency(100)).toBeCloseTo(comboFrequency(40));
  });
});

describe("createAudioEngine", () => {
  let contexts: FakeAudioContext[];
  let engine: AudioEngine;

  beforeEach(() => {
    const factory = createFakeContextFactory();
    contexts = factory.contexts;
    engine = createAudioEngine({ createContext: factory.createContext });
  });

  it("does not create a context until unlock()", () => {
    expect(contexts).toHaveLength(0);
    expect(engine.isUnlocked()).toBe(false);
  });

  it("ignores play() before unlock without throwing", () => {
    expect(() => engine.play("key")).not.toThrow();
    expect(contexts).toHaveLength(0);
  });

  it("creates and resumes the context on unlock()", async () => {
    await engine.unlock();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalled();
    expect(engine.isUnlocked()).toBe(true);
    await engine.unlock();
    expect(contexts).toHaveLength(1);
  });

  it("starts an oscillator for play('key') after unlock", async () => {
    await engine.unlock();
    const before = contexts[0].oscillators.length;
    engine.play("key");
    const created = contexts[0].oscillators.slice(before);
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((o) => o.started !== undefined)).toBe(true);
    expect(created.every((o) => o.stopped !== undefined)).toBe(true);
  });

  it.each(["miss", "clear", "perfect", "combo", "fever", "result"] as const)(
    "synthesizes %s without throwing",
    async (sfx) => {
      await engine.unlock();
      const before = contexts[0].oscillators.length;
      engine.play(sfx, { combo: 10 });
      expect(contexts[0].oscillators.length).toBeGreaterThan(before);
    },
  );

  it("does not create oscillators when sfx is disabled", async () => {
    await engine.unlock();
    engine.setEnabled({ sfx: false });
    const before = contexts[0].oscillators.length;
    engine.play("key");
    expect(contexts[0].oscillators.length).toBe(before);
  });

  it("raises combo pitch with combo count", async () => {
    await engine.unlock();
    const ctx = contexts[0];
    engine.play("combo", { combo: 5 });
    const low = ctx.oscillators.at(-1)!.frequency.value;
    engine.play("combo", { combo: 20 });
    const high = ctx.oscillators.at(-1)!.frequency.value;
    expect(high).toBeGreaterThan(low);
  });

  it("changes master gain with setVolume", async () => {
    await engine.unlock();
    engine.setVolume({ sfx: 100, bgm: 100 });
    const [sfxGain, bgmGain] = contexts[0].gains;
    expect(sfxGain.gain.value).toBeCloseTo(1);
    expect(bgmGain.gain.value).toBeCloseTo(1);
    engine.setVolume({ sfx: 50 });
    expect(sfxGain.gain.value).toBeCloseTo(0.25);
    expect(bgmGain.gain.value).toBeCloseTo(1);
  });

  it("remembers volume set before unlock", async () => {
    engine.setVolume({ sfx: 0, bgm: 50 });
    await engine.unlock();
    const [sfxGain, bgmGain] = contexts[0].gains;
    expect(sfxGain.gain.value).toBe(0);
    expect(bgmGain.gain.value).toBeCloseTo(0.25);
  });

  it("starts BGM oscillators and stops them on stopBgm", async () => {
    await engine.unlock();
    const ctx = contexts[0];
    const before = ctx.oscillators.length;
    engine.startBgm();
    const bgmOsc = ctx.oscillators.slice(before);
    expect(bgmOsc.length).toBeGreaterThan(0);
    expect(bgmOsc.every((o) => o.started !== undefined)).toBe(true);
    engine.startBgm();
    expect(ctx.oscillators.length).toBe(before + bgmOsc.length);
    engine.stopBgm();
    expect(bgmOsc.every((o) => o.stopped !== undefined)).toBe(true);
  });

  it("does not start BGM when bgm is disabled, and stops when disabled later", async () => {
    await engine.unlock();
    const ctx = contexts[0];
    engine.setEnabled({ bgm: false });
    engine.startBgm();
    expect(ctx.oscillators).toHaveLength(0);
    engine.setEnabled({ bgm: true });
    engine.startBgm();
    const running = ctx.oscillators.filter((o) => o.stopped === undefined);
    expect(running.length).toBeGreaterThan(0);
    engine.setEnabled({ bgm: false });
    expect(ctx.oscillators.every((o) => o.stopped !== undefined)).toBe(true);
  });

  it("ignores startBgm before unlock", () => {
    expect(() => engine.startBgm()).not.toThrow();
    expect(contexts).toHaveLength(0);
  });

  it("toggles the fever layer gain without creating new oscillators", async () => {
    await engine.unlock();
    engine.startBgm();
    const ctx = contexts[0];
    const countBefore = ctx.oscillators.length;
    engine.setFeverLayer(true);
    expect(ctx.oscillators.length).toBe(countBefore);
    const feverGain = ctx.gains.find((g) =>
      g.gain.calls.some((c) => c.method === "linearRampToValueAtTime" && c.value > 0),
    );
    expect(feverGain).toBeDefined();
    engine.setFeverLayer(false);
    expect(ctx.oscillators.length).toBe(countBefore);
  });

  it("applies settings at once", async () => {
    await engine.unlock();
    engine.applySettings({ ...DEFAULT_SETTINGS, sfxEnabled: false, bgmVolume: 100 });
    const before = contexts[0].oscillators.length;
    engine.play("key");
    expect(contexts[0].oscillators.length).toBe(before);
    expect(contexts[0].gains[1].gain.value).toBeCloseTo(1);
  });

  it("closes the context on dispose", async () => {
    await engine.unlock();
    engine.dispose();
    expect(contexts[0].close).toHaveBeenCalled();
    expect(engine.isUnlocked()).toBe(false);
  });

  it("falls back to a no-op engine when AudioContext is unavailable", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    try {
      const noop = createAudioEngine();
      await expect(noop.unlock()).resolves.toBeUndefined();
      expect(noop.isUnlocked()).toBe(false);
      expect(() => noop.play("key")).not.toThrow();
      expect(() => noop.startBgm()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
