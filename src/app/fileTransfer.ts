/**
 * 設定の JSON 書き出し。
 * Android Chrome は `<a download>` で保存できる。
 * iOS Chrome はユーザー操作の呼び出しスタックを離れたあとの programmatic download を無視するため、
 * 準備済みファイルをタップで保存する経路を別に持つ。
 */

/** iPhone / iPad の Chrome（CriOS）および iPadOS のデスクトップ UA */
export function needsExplicitFileSave(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  const platform = navigator.platform || "";
  return platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function triggerFileDownload(blob: Blob, fileName: string): void {
  try {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // すぐ revoke するとモバイル Chrome で保存が始まる前に URL が無効になる
    const timer = window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    const handle = timer as unknown as { unref?: () => void };
    handle.unref?.();
  } catch {
    // createObjectURL が無い環境では何もしない
  }
}

export type ShareResult = "shared" | "downloaded" | "aborted";

/** ファイルが既にある状態で、ユーザージェスチャの中から共有または保存する */
export async function shareOrDownloadFile(file: File): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      // share() 自体は await より前に呼ぶ（iOS Chrome のユーザー操作要件）
      await navigator.share({ files: [file], title: file.name });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "aborted";
    }
  }
  triggerFileDownload(file, file.name);
  return "downloaded";
}
