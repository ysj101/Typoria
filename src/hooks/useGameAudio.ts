/**
 * オーディオエンジン（#13）をゲームエンジンのイベントに結線する。
 * 仕様: docs/spec.md §9.2 サウンド、§6.4 FEVER 中の音響、AC-04、AC-14
 */
import { useEffect } from "react";
import type { AudioEngine } from "../game/audio";
import type { EngineEvent, GameEngine } from "../game/engine";
import { COMBO_SOUND_STEPS, type Settings } from "../types/game";
import { useAudio } from "./useAudio";

/** ゲームイベントを SE / BGM 操作に変換する（テストしやすいよう分離） */
export function handleGameAudioEvent(audio: AudioEngine, event: EngineEvent): void {
  switch (event.type) {
    case "start":
      audio.startBgm();
      break;
    case "correct":
      audio.play("key");
      break;
    case "incorrect":
      audio.play("miss");
      break;
    case "clear":
      audio.play(event.perfect ? "perfect" : "clear");
      break;
    case "combo":
      if (COMBO_SOUND_STEPS.includes(event.combo)) audio.play("combo", { combo: event.combo });
      break;
    case "fever_start":
      audio.play("fever");
      audio.setFeverLayer(true);
      break;
    case "fever_end":
      audio.setFeverLayer(false);
      break;
    case "pause":
      audio.stopBgm();
      break;
    case "resume":
      audio.startBgm();
      break;
    case "finish":
      audio.stopBgm();
      audio.setFeverLayer(false);
      audio.play("result");
      break;
    default:
      break;
  }
}

/**
 * 設定を反映しつつ、エンジンのイベントを購読して効果音・BGM を鳴らす。
 * アンマウント時に購読を解除し BGM を止める。
 */
export function useGameAudio(
  engine: GameEngine,
  settings: Settings,
  audio?: AudioEngine,
): AudioEngine {
  const current = useAudio(settings, audio);

  useEffect(() => {
    const unsubscribe = engine.onEvent((event) => handleGameAudioEvent(current, event));
    return () => {
      unsubscribe();
      current.stopBgm();
      current.setFeverLayer(false);
    };
  }, [engine, current]);

  return current;
}
