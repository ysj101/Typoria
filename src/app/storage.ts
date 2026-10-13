import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  type DailyMissionProgress,
  type Settings,
  type UserProgress,
} from "../types/game";

/**
 * アプリシェルが設定・進捗の読み書きに使う最小インターフェース（docs/spec.md §2.1）。
 * IndexedDB 実装（#11）はこのインターフェースを満たす。
 */
export interface AppStorage {
  getSettings(): Promise<Settings>;
  putSettings(settings: Settings): Promise<void>;
  getProgress(): Promise<UserProgress>;
  putProgress(progress: UserProgress): Promise<void>;
  /** 当日のデイリーミッション進捗（§8.2）。未実装・未保存なら undefined */
  getMission?(dateKey: string): Promise<DailyMissionProgress | undefined>;
}

/** テストやストレージ未接続時に使うメモリ実装 */
export function createMemoryStorage(
  initial: { settings?: Partial<Settings>; progress?: Partial<UserProgress> } = {},
): AppStorage {
  let settings: Settings = { ...DEFAULT_SETTINGS, ...initial.settings };
  let progress: UserProgress = { ...DEFAULT_PROGRESS, ...initial.progress };
  return {
    getSettings: async () => settings,
    putSettings: async (next) => {
      settings = next;
    },
    getProgress: async () => progress,
    putProgress: async (next) => {
      progress = next;
    },
    getMission: async () => undefined,
  };
}
