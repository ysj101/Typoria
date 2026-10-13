import { useContext } from "react";
import { AppContext, type AppContextValue } from "./AppContext";

/** 設定・進捗コンテキストを取得する。AppProvider の外で呼ぶと例外 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within <AppProvider>");
  return ctx;
}
