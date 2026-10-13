/**
 * 設定をオーディオエンジンへ即時反映するフック。
 * 仕様: docs/spec.md §9.2 サウンド、§4.5 設定
 */
import { useEffect, useState } from "react";
import { createAudioEngine, type AudioEngine } from "../game/audio";
import type { Settings } from "../types/game";

let sharedEngine: AudioEngine | null = null;

/** アプリ全体で共有するオーディオエンジン（遅延生成） */
export function getSharedAudioEngine(): AudioEngine {
  if (!sharedEngine) sharedEngine = createAudioEngine();
  return sharedEngine;
}

/**
 * 設定変更を即時反映し、安定した参照のエンジンを返す。
 * `engine` を渡すと共有エンジンの代わりにそれを使う（テスト用）。
 */
export function useAudio(settings: Settings, engine?: AudioEngine): AudioEngine {
  const [current] = useState<AudioEngine>(() => engine ?? getSharedAudioEngine());

  useEffect(() => {
    current.applySettings(settings);
  }, [current, settings]);

  return current;
}
