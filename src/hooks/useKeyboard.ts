/**
 * DOM のキーイベントをゲーム操作（文字入力・スキップ・一時停止）に変換するフック。
 * 仕様: docs/spec.md §5.4 キーボード操作、§18.2 入力速度を最優先、AC-16（IME）
 * スマホ Chrome は不可視 input の beforeinput / input を正とする（#59）。
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export type KeyAction =
  { type: "char"; char: string } | { type: "skip" } | { type: "pause" } | { type: "ignore" };

export type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing" | "keyCode"
>;

/** IME 変換中の keydown（§5.4）。Android Gboard も keyCode 229 / Unidentified になる */
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

/** `beforeinput` / `input` から取り出せる操作（#59） */
export type BeforeInputAction =
  | { type: "char"; char: string }
  | { type: "text"; chars: string[] }
  | { type: "backspace" }
  | { type: "ignore" };

export interface BeforeInputLike {
  inputType: string;
  data?: string | null;
  isComposing?: boolean;
}

/** IME の変換途中・確定前。判定しない（AC-16） */
const COMPOSITION_INPUT_TYPES = new Set([
  "insertCompositionText",
  "insertFromComposition",
  "deleteCompositionText",
  "deleteByComposition",
]);

/**
 * `beforeinput` / `input` をゲーム操作に分類する（#59）。
 * Gboard は keydown が `Unidentified` / keyCode 229 のため、こちらの `data` / `inputType` を正とする。
 * - `insertText` の data を文字入力（1 文字は char、複数文字は text）
 * - `deleteContentBackward` は Backspace（§5.2: ゲーム側では確定済み文字を戻さない）
 * - 変換中（`isComposing` や composition inputType）は無視
 */
export function classifyBeforeInput(e: BeforeInputLike): BeforeInputAction {
  if (e.isComposing || COMPOSITION_INPUT_TYPES.has(e.inputType)) return { type: "ignore" };
  if (e.inputType === "deleteContentBackward") return { type: "backspace" };
  if (e.inputType === "insertText" || e.inputType === "insertReplacementText") {
    const chars = [...(e.data ?? "")].filter((ch) => ch !== "\n" && ch !== "\r");
    if (chars.length === 1) return { type: "char", char: chars[0]! };
    if (chars.length > 1) return { type: "text", chars };
  }
  return { type: "ignore" };
}

export interface UseKeyboardOptions {
  enabled: boolean;
  onChar: (char: string) => void;
  onSkip?: () => void;
  onPause?: () => void;
  /** 指定時はこの要素の keydown を購読し、要素内にフォーカスがある場合のみ有効 */
  target?: RefObject<HTMLElement | null>;
  /**
   * ソフトキーボード用 input。指定時は `beforeinput` / `input` からも文字を取り、
   * 処理後に value を空にして物理キーボードとの二重入力を防ぐ（#59）。
   */
  textInput?: RefObject<HTMLInputElement | null>;
}

function focusAllows(target: RefObject<HTMLElement | null> | undefined): boolean {
  if (!target) return true;
  const node = target.current;
  return Boolean(node && node.contains(document.activeElement));
}

function readInputLike(event: Event): BeforeInputLike {
  const ie = event as InputEvent;
  return {
    inputType: typeof ie.inputType === "string" ? ie.inputType : "",
    data: typeof ie.data === "string" ? ie.data : null,
    isComposing: Boolean(ie.isComposing),
  };
}

function charsFrom(action: BeforeInputAction): string[] | null {
  if (action.type === "char") return [action.char];
  if (action.type === "text") return action.chars;
  return null;
}

/**
 * キーボード入力をゲーム操作に結線する。
 * コールバックはイベントハンドラ内で同期的に呼ぶ（§18.2）。
 * 最新の options は ref 経由で参照し、`enabled` / `target` / `textInput` が変わらない限りリスナーは再登録しない。
 */
export function useKeyboard(options: UseKeyboardOptions): void {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const { enabled, target, textInput } = options;

  useEffect(() => {
    if (!enabled) return;

    const element: HTMLElement | Window | null = target ? target.current : window;
    if (!element) return;
    const textEl = textInput?.current ?? null;

    // 物理キーが既に onChar した文字。続く beforeinput / input の同一文字はエコーとして捨てる。
    let echoChar: string | null = null;
    // beforeinput で処理済みなら、続く input では文字を再送しない。
    let handledByBeforeInput = false;

    const clearTextInput = () => {
      const el = optionsRef.current.textInput?.current;
      if (el && el.value !== "") el.value = "";
    };

    const emitChars = (chars: string[]) => {
      const current = optionsRef.current;
      for (const ch of chars) current.onChar(ch);
    };

    const onKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;
      const current = optionsRef.current;
      if (!current.enabled) return;
      if (!focusAllows(target)) return;

      // 直前のキーの未消費エコーは、次の keydown まで来なければもう来ない。
      echoChar = null;
      handledByBeforeInput = false;

      const action = classifyKeyEvent(e);
      switch (action.type) {
        case "char":
          echoChar = action.char;
          e.preventDefault();
          current.onChar(action.char);
          clearTextInput();
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

    const applyTextAction = (event: Event, action: BeforeInputAction): boolean => {
      const chars = charsFrom(action);
      if (chars) {
        if (chars.length === 1 && chars[0] === echoChar) {
          echoChar = null;
          if (event.cancelable) event.preventDefault();
          clearTextInput();
          return true;
        }
        echoChar = null;
        if (event.cancelable) event.preventDefault();
        emitChars(chars);
        clearTextInput();
        return true;
      }
      if (action.type === "backspace") {
        if (event.cancelable) event.preventDefault();
        clearTextInput();
        return true;
      }
      return false;
    };

    const onBeforeInput = (event: Event) => {
      const current = optionsRef.current;
      if (!current.enabled || !focusAllows(target)) return;
      handledByBeforeInput = false;
      if (applyTextAction(event, classifyBeforeInput(readInputLike(event)))) {
        handledByBeforeInput = true;
      }
    };

    const onInput = (event: Event) => {
      const current = optionsRef.current;
      if (!current.enabled || !focusAllows(target)) return;
      if (handledByBeforeInput) {
        handledByBeforeInput = false;
        clearTextInput();
        return;
      }
      const like = readInputLike(event);
      if (like.isComposing || COMPOSITION_INPUT_TYPES.has(like.inputType)) return;
      if (applyTextAction(event, classifyBeforeInput(like))) return;

      // data を持たない input のフォールバック。挿入済みの value を 1 文字ずつ渡して空にする。
      const el = current.textInput?.current;
      if (!el || el.value === "") return;
      if (
        like.inputType !== "" &&
        like.inputType !== "insertText" &&
        like.inputType !== "insertReplacementText"
      ) {
        return;
      }
      const chars = [...el.value].filter((ch) => ch !== "\n" && ch !== "\r");
      el.value = "";
      if (chars.length === 1 && chars[0] === echoChar) {
        echoChar = null;
        return;
      }
      echoChar = null;
      emitChars(chars);
    };

    element.addEventListener("keydown", onKeyDown);
    textEl?.addEventListener("beforeinput", onBeforeInput);
    textEl?.addEventListener("input", onInput);
    return () => {
      element.removeEventListener("keydown", onKeyDown);
      textEl?.removeEventListener("beforeinput", onBeforeInput);
      textEl?.removeEventListener("input", onInput);
    };
  }, [enabled, target, textInput]);
}
