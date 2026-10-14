import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const settingsRef = useRef(settings);
  // 連続した更新の書き込み順を保つ。遅い先行書き込みが後の値を上書きしない。
  const settingsWrite = useRef(Promise.resolve());

  const publishSettings = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([storage.getSettings(), storage.getProgress()]);
    publishSettings(s);
    setProgress(p);
    setReady(true);
  }, [publishSettings, storage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, p] = await Promise.all([storage.getSettings(), storage.getProgress()]);
      if (cancelled) return;
      publishSettings(s);
      setProgress(p);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [publishSettings, storage]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const merged = { ...settingsRef.current, ...patch };
      publishSettings(merged);
      const write = settingsWrite.current.then(() => storage.putSettings(merged));
      settingsWrite.current = write.then(
        () => undefined,
        () => undefined,
      );
      await write;
    },
    [publishSettings, storage],
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
