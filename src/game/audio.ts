/**
 * オーディオエンジン（Web Audio API）。React 非依存。
 * 仕様: docs/spec.md §9.2 サウンド、§4.5 設定、§18.2 入力速度を最優先
 *
 * - SE / BGM はすべてオシレーター合成（音源ファイル不要）
 * - `unlock()` を PLAY 操作後に呼ぶまで AudioContext を生成しない（自動再生制限対応）
 * - `play()` は同期的に発火し、unlock 前・無効時は例外を出さず無視する
 */
import type { Settings } from "../types/game";

/** 効果音の種類（§9.2） */
export type SfxName = "key" | "miss" | "clear" | "perfect" | "combo" | "fever" | "result";

export interface PlayOptions {
  /** `combo` SE の音程に使うコンボ数 */
  combo?: number;
}

export interface AudioEngine {
  /** AudioContext を生成して resume する。PLAY 操作後に呼ぶ */
  unlock(): Promise<void>;
  isUnlocked(): boolean;
  /** 効果音を同期的に再生。unlock 前・sfx 無効時は無視 */
  play(sfx: SfxName, opts?: PlayOptions): void;
  startBgm(): void;
  stopBgm(): void;
  /** FEVER 中の追加レイヤー（§6.4） */
  setFeverLayer(on: boolean): void;
  /** 音量 0〜100 */
  setVolume(v: { sfx?: number; bgm?: number }): void;
  setEnabled(e: { sfx?: boolean; bgm?: boolean }): void;
  /** 設定をまとめて反映（§4.5） */
  applySettings(s: Settings): void;
  dispose(): void;
}

export interface AudioEngineOptions {
  /** テスト用。省略時は `window.AudioContext` */
  createContext?: () => AudioContext;
}

/** 0〜100 の音量を 0〜1 のゲインへ（聴感補正に 2 乗カーブ） */
export function volumeToGain(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v * v;
}

/** コンボ SE の基音周波数。コンボ数で半音ずつ上昇、40 で頭打ち */
export function comboFrequency(combo: number): number {
  const n = Math.min(40, Math.max(0, combo));
  return 440 * Math.pow(2, n / 12);
}

const SFX_SILENT_GAIN = 0.0001;
const BGM_LAYER_GAIN = 0.35;
const FEVER_LAYER_GAIN = 0.25;
const BGM_SCHEDULE_AHEAD_SEC = 1.2;
const BGM_SCHEDULE_INTERVAL_MS = 400;
const BGM_STEP_SEC = 0.25;
/** A マイナー・ペンタトニック風のアルペジオ（Hz） */
const BGM_ARPEGGIO = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];

function defaultCreateContext(): AudioContext | null {
  const w = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  let ctx: AudioContext | null = null;
  let sfxGain: GainNode | null = null;
  let bgmGain: GainNode | null = null;
  let feverGain: GainNode | null = null;
  let unlocked = false;
  let unlocking: Promise<void> | null = null;

  let sfxEnabled = true;
  let bgmEnabled = true;
  let sfxVolume = 70;
  let bgmVolume = 40;
  let feverOn = false;

  // BGM state
  let bgmVoices: Voice[] = [];
  let bgmArpeggio: Voice | null = null;
  let bgmTimer: ReturnType<typeof setInterval> | null = null;
  let bgmNextStepTime = 0;
  let bgmStepIndex = 0;

  function applyGains() {
    if (!ctx || !sfxGain || !bgmGain || !feverGain) return;
    const t = ctx.currentTime;
    sfxGain.gain.setValueAtTime(volumeToGain(sfxVolume), t);
    bgmGain.gain.setValueAtTime(volumeToGain(bgmVolume), t);
  }

  async function unlock(): Promise<void> {
    if (unlocked) return;
    if (unlocking) return unlocking;
    unlocking = (async () => {
      const created = options.createContext ? options.createContext() : defaultCreateContext();
      if (!created) return;
      ctx = created;
      sfxGain = ctx.createGain();
      bgmGain = ctx.createGain();
      feverGain = ctx.createGain();
      sfxGain.connect(ctx.destination);
      bgmGain.connect(ctx.destination);
      feverGain.gain.setValueAtTime(0, ctx.currentTime);
      feverGain.connect(bgmGain);
      applyGains();
      try {
        await ctx.resume();
      } catch {
        // resume に失敗しても例外は外に出さない（ユーザー操作待ち）
      }
      unlocked = true;
    })();
    try {
      await unlocking;
    } finally {
      unlocking = null;
    }
  }

  /** 1 音を ADSR 風エンベロープで鳴らす */
  function tone(
    freq: number,
    type: OscillatorType,
    startAt: number,
    durationSec: number,
    peak: number,
    attackSec = 0.005,
    sweepTo?: number,
  ) {
    if (!ctx || !sfxGain) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    if (sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(sweepTo, startAt + durationSec);
    }
    env.gain.setValueAtTime(SFX_SILENT_GAIN, startAt);
    env.gain.linearRampToValueAtTime(peak, startAt + attackSec);
    env.gain.exponentialRampToValueAtTime(SFX_SILENT_GAIN, startAt + durationSec);
    osc.connect(env);
    env.connect(sfxGain);
    osc.start(startAt);
    osc.stop(startAt + durationSec + 0.02);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  function play(sfx: SfxName, opts: PlayOptions = {}): void {
    if (!unlocked || !ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    try {
      switch (sfx) {
        case "key":
          tone(1200, "sine", t, 0.03, 0.5, 0.002);
          break;
        case "miss":
          tone(160, "square", t, 0.12, 0.35, 0.005);
          break;
        case "clear":
          tone(659.25, "triangle", t, 0.12, 0.5);
          tone(987.77, "triangle", t + 0.08, 0.16, 0.5);
          break;
        case "perfect":
          tone(783.99, "triangle", t, 0.1, 0.5);
          tone(1046.5, "triangle", t + 0.07, 0.1, 0.5);
          tone(1567.98, "triangle", t + 0.14, 0.22, 0.5);
          break;
        case "combo": {
          const f = comboFrequency(opts.combo ?? 0);
          tone(f, "sine", t, 0.14, 0.55);
          tone(f * 1.5, "sine", t + 0.05, 0.14, 0.35);
          break;
        }
        case "fever":
          tone(220, "sawtooth", t, 0.5, 0.4, 0.01, 1760);
          tone(440, "triangle", t + 0.25, 0.35, 0.4, 0.01, 1760);
          break;
        case "result":
          tone(523.25, "triangle", t, 0.14, 0.5);
          tone(659.25, "triangle", t + 0.12, 0.14, 0.5);
          tone(783.99, "triangle", t + 0.24, 0.14, 0.5);
          tone(1046.5, "triangle", t + 0.36, 0.45, 0.55);
          break;
      }
    } catch {
      // 音声の失敗はゲーム進行を止めない
    }
  }

  function scheduleArpeggio() {
    if (!ctx || !bgmArpeggio) return;
    const horizon = ctx.currentTime + BGM_SCHEDULE_AHEAD_SEC;
    while (bgmNextStepTime < horizon) {
      const freq = BGM_ARPEGGIO[bgmStepIndex % BGM_ARPEGGIO.length];
      bgmArpeggio.osc.frequency.setValueAtTime(freq, bgmNextStepTime);
      bgmArpeggio.gain.gain.setValueAtTime(0.18, bgmNextStepTime);
      bgmArpeggio.gain.gain.linearRampToValueAtTime(0.02, bgmNextStepTime + BGM_STEP_SEC * 0.9);
      bgmNextStepTime += BGM_STEP_SEC;
      bgmStepIndex += 1;
    }
  }

  function startBgm(): void {
    if (!unlocked || !ctx || !bgmGain || !feverGain || !bgmEnabled) return;
    if (bgmVoices.length > 0) return;
    const t = ctx.currentTime;

    // 低音ドローン（2 本）
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = "triangle";
    drone.frequency.setValueAtTime(55, t);
    droneGain.gain.setValueAtTime(0, t);
    droneGain.gain.linearRampToValueAtTime(BGM_LAYER_GAIN, t + 0.5);
    drone.connect(droneGain);
    droneGain.connect(bgmGain);
    drone.start(t);

    const pad = ctx.createOscillator();
    const padGain = ctx.createGain();
    pad.type = "sine";
    pad.frequency.setValueAtTime(110, t);
    padGain.gain.setValueAtTime(0, t);
    padGain.gain.linearRampToValueAtTime(BGM_LAYER_GAIN * 0.6, t + 0.5);
    pad.connect(padGain);
    padGain.connect(bgmGain);
    pad.start(t);

    // LFO でパッドをゆっくり揺らす
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.2, t);
    lfoGain.gain.setValueAtTime(0.08, t);
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start(t);

    // アルペジオ（時刻スケジュール）
    const arp = ctx.createOscillator();
    const arpGain = ctx.createGain();
    arp.type = "square";
    arpGain.gain.setValueAtTime(0, t);
    arp.connect(arpGain);
    arpGain.connect(bgmGain);
    arp.start(t);

    // FEVER レイヤー（明るいパッド。gain で ON/OFF）
    const fever = ctx.createOscillator();
    fever.type = "sawtooth";
    fever.frequency.setValueAtTime(440, t);
    const fever2 = ctx.createOscillator();
    fever2.type = "sawtooth";
    fever2.frequency.setValueAtTime(443, t);
    fever.connect(feverGain);
    fever2.connect(feverGain);
    fever.start(t);
    fever2.start(t);

    bgmVoices = [
      { osc: drone, gain: droneGain },
      { osc: pad, gain: padGain },
      { osc: lfo, gain: lfoGain },
      { osc: arp, gain: arpGain },
      { osc: fever, gain: feverGain },
      { osc: fever2, gain: feverGain },
    ];
    bgmArpeggio = { osc: arp, gain: arpGain };
    bgmNextStepTime = t;
    bgmStepIndex = 0;
    scheduleArpeggio();
    bgmTimer = setInterval(scheduleArpeggio, BGM_SCHEDULE_INTERVAL_MS);
    setFeverLayer(feverOn);
  }

  function stopBgm(): void {
    if (bgmTimer !== null) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (!ctx) {
      bgmVoices = [];
      bgmArpeggio = null;
      return;
    }
    const t = ctx.currentTime;
    for (const v of bgmVoices) {
      try {
        v.osc.stop(t + 0.05);
        v.osc.onended = () => {
          v.osc.disconnect();
          if (v.gain !== feverGain) v.gain.disconnect();
        };
      } catch {
        // 既に停止済み
      }
    }
    if (feverGain) feverGain.gain.setValueAtTime(0, t);
    bgmVoices = [];
    bgmArpeggio = null;
  }

  function setFeverLayer(on: boolean): void {
    feverOn = on;
    if (!ctx || !feverGain || bgmVoices.length === 0) return;
    const t = ctx.currentTime;
    feverGain.gain.cancelScheduledValues(t);
    feverGain.gain.setValueAtTime(feverGain.gain.value, t);
    feverGain.gain.linearRampToValueAtTime(on ? FEVER_LAYER_GAIN : 0, t + 0.5);
  }

  function setVolume(v: { sfx?: number; bgm?: number }): void {
    if (v.sfx !== undefined) sfxVolume = v.sfx;
    if (v.bgm !== undefined) bgmVolume = v.bgm;
    applyGains();
  }

  function setEnabled(e: { sfx?: boolean; bgm?: boolean }): void {
    if (e.sfx !== undefined) sfxEnabled = e.sfx;
    if (e.bgm !== undefined) {
      bgmEnabled = e.bgm;
      if (!bgmEnabled) stopBgm();
    }
  }

  function applySettings(s: Settings): void {
    setVolume({ sfx: s.sfxVolume, bgm: s.bgmVolume });
    setEnabled({ sfx: s.sfxEnabled, bgm: s.bgmEnabled });
  }

  function dispose(): void {
    stopBgm();
    if (ctx) {
      void ctx.close().catch(() => {});
    }
    ctx = null;
    sfxGain = null;
    bgmGain = null;
    feverGain = null;
    unlocked = false;
  }

  return {
    unlock,
    isUnlocked: () => unlocked,
    play,
    startBgm,
    stopBgm,
    setFeverLayer,
    setVolume,
    setEnabled,
    applySettings,
    dispose,
  };
}
