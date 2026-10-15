import { useEffect, useState } from "react";
import type { AppStorage } from "../app/storage";
import type { TermProgress } from "../types/term";

/** ストレージの学習記録を読み込む。読み込み中は空配列 */
export function useTermProgress(storage: Pick<AppStorage, "listTermProgress">): TermProgress[] {
  const [progress, setProgress] = useState<TermProgress[]>([]);
  useEffect(() => {
    let cancelled = false;
    void storage.listTermProgress().then((rows) => {
      if (!cancelled) setProgress(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);
  return progress;
}
