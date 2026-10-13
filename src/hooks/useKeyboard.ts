/**
 * DOM のキーイベントをゲーム操作（文字入力・スキップ・一時停止）に変換するフック。
 * 仕様: docs/spec.md §5.4 キーボード操作、§18.2 入力速度を最優先、AC-16（IME）
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export type KeyAction =
  { type: "char"; char: string } | { type: "skip" } | { type: "pause" } | { type: "ignore" };

export type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing" | "keyCode"
>;

/** IME 変換中の keydown（§5.4） */
const IME_KEY_CODE = 229;

/**
 * キーイベントをゲーム操作に分類する純関数（§5.4）。
 * - IME 変換中（`isComposing` / `keyCode === 229`）は無視
 * - `Escape` → pause、`Ctrl/Cmd + Enter` → skip
 * - Tab と修飾キー付きの文字は無視
 * - 1 文字キーのみ char
 */
export function classifyKeyEvent(e: KeyEventLike): KeyAction {
  if (e.isComposing || e.keyCode === IME_KEY_CODE) return { type: "ignore" };
  if (e.key === "Escape") return { type: "pause" };
  if (e.key === "Enter") return e.ctrlKey || e.metaKey ? { type: "skip" } : { type: "ignore" };
  if (e.key === "Tab") return { type: "ignore" };
  if (e.ctrlKey || e.metaKey || e.altKey) return { type: "ignore" };
  if (e.key.length === 1) return { type: "char", char: e.key };
  return { type: "ignore" };
}

export interface UseKeyboardOptions {
  enabled: boolean;
  onChar: (char: string) => void;
  onSkip?: () => void;
  onPause?: () => void;
  /** 指定時はこの要素の keydown を購読し、要素内にフォーカスがある場合のみ有効 */
  target?: RefObject<HTMLElement | null>;
}

/**
 * キーボード入力をゲーム操作に結線する。
 * コールバックは keydown ハンドラ内で同期的に呼ぶ（§18.2）。
 * 最新の options は ref 経由で参照し、`enabled` / `target` が変わらない限りリスナーは再登録しない。
 */
export function useKeyboard(options: UseKeyboardOptions): void {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const { enabled, target } = options;

  useEffect(() => {
    if (!enabled) return;

    const element: HTMLElement | Window | null = target ? target.current : window;
    if (!element) return;

    const handler = (event: Event) => {
      const e = event as KeyboardEvent;
      const current = optionsRef.current;
      if (!current.enabled) return;
      if (target) {
        const node = target.current;
        if (!node || !node.contains(document.activeElement)) return;
      }

      const action = classifyKeyEvent(e);
      switch (action.type) {
        case "char":
          e.preventDefault();
          current.onChar(action.char);
          return;
        case "skip":
          e.preventDefault();
          current.onSkip?.();
          return;
        case "pause":
          e.preventDefault();
          current.onPause?.();
          return;
        case "ignore":
          return;
      }
    };

    element.addEventListener("keydown", handler);
    return () => element.removeEventListener("keydown", handler);
  }, [enabled, target]);
}
