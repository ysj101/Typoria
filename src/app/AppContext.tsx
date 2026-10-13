import { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext } from "./context";
import type { ReactNode } from "react";
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  type Settings,
  type UserProgress,
} from "../types/game";
import { createMemoryStorage, type AppStorage } from "./storage";

/** 設定とユーザー進捗をアプリ全体に配布するコンテキスト（docs/spec.md §4, §2.1） */
export interface AppContextValue {
  /** ストレージからの初回読み込みが完了したか */
  ready: boolean;
  settings: Settings;
  progress: UserProgress;
  /** 設定を更新して即時保存する（§4.5） */
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** 進捗を更新して保存する */
  updateProgress(next: UserProgress): Promise<void>;
  /** ストレージから再読み込みする（セッション確定後など） */
  refresh(): Promise<void>;
  storage: AppStorage;
}

export interface AppProviderProps {
  storage?: AppStorage;
  children: ReactNode;
}

export function AppProvider({ storage: storageProp, children }: AppProviderProps) {
  const [storage] = useState<AppStorage>(() => storageProp ?? createMemoryStorage());
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);

  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([storage.getSettings(), storage.getProgress()]);
    setSettings(s);
    setProgress(p);
    setReady(true);
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, p] = await Promise.all([storage.getSettings(), storage.getProgress()]);
      if (cancelled) return;
      setSettings(s);
      setProgress(p);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      let next: Settings | undefined;
      setSettings((prev) => {
        next = { ...prev, ...patch };
        return next;
      });
      // setState の更新関数は同期的に実行されるが、念のため現在値から再計算する
      const merged = next ?? { ...settings, ...patch };
      await storage.putSettings(merged);
    },
    [settings, storage],
  );

  const updateProgress = useCallback(
    async (next: UserProgress) => {
      setProgress(next);
      await storage.putProgress(next);
    },
    [storage],
  );

  const value = useMemo<AppContextValue>(
    () => ({ ready, settings, progress, updateSettings, updateProgress, refresh, storage }),
    [ready, settings, progress, updateSettings, updateProgress, refresh, storage],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
