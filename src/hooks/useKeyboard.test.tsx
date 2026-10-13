import { fireEvent, render, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { classifyKeyEvent, useKeyboard, type UseKeyboardOptions } from "./useKeyboard";

const key = (overrides: Partial<KeyboardEventInit> & { key: string }) => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  keyCode: 0,
  ...overrides,
});

describe("classifyKeyEvent (§5.4)", () => {
  it("returns char for single printable keys", () => {
    expect(classifyKeyEvent(key({ key: "a" }))).toEqual({ type: "char", char: "a" });
    expect(classifyKeyEvent(key({ key: "A" }))).toEqual({ type: "char", char: "A" });
    expect(classifyKeyEvent(key({ key: " " }))).toEqual({ type: "char", char: " " });
    expect(classifyKeyEvent(key({ key: "'" }))).toEqual({ type: "char", char: "'" });
  });

  it("ignores IME composition (isComposing / keyCode 229)", () => {
    expect(classifyKeyEvent(key({ key: "a", isComposing: true }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "Process", keyCode: 229 }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "Escape", isComposing: true }))).toEqual({ type: "ignore" });
  });

  it("maps Escape to pause and Ctrl/Meta+Enter to skip", () => {
    expect(classifyKeyEvent(key({ key: "Escape" }))).toEqual({ type: "pause" });
    expect(classifyKeyEvent(key({ key: "Enter", ctrlKey: true }))).toEqual({ type: "skip" });
    expect(classifyKeyEvent(key({ key: "Enter", metaKey: true }))).toEqual({ type: "skip" });
    expect(classifyKeyEvent(key({ key: "Enter" }))).toEqual({ type: "ignore" });
  });

  it("ignores Tab, modifier combos and non-character keys", () => {
    expect(classifyKeyEvent(key({ key: "Tab" }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "a", ctrlKey: true }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "a", metaKey: true }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "a", altKey: true }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "Shift" }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "Backspace" }))).toEqual({ type: "ignore" });
    expect(classifyKeyEvent(key({ key: "ArrowLeft" }))).toEqual({ type: "ignore" });
  });
});

function setup(overrides: Partial<UseKeyboardOptions> = {}) {
  const onChar = vi.fn();
  const onSkip = vi.fn();
  const onPause = vi.fn();
  const hook = renderHook(() =>
    useKeyboard({ enabled: true, onChar, onSkip, onPause, ...overrides }),
  );
  return { onChar, onSkip, onPause, hook };
}

describe("useKeyboard", () => {
  it("calls onChar synchronously for character keys", () => {
    const { onChar } = setup();
    fireEvent.keyDown(window, { key: "t" });
    expect(onChar).toHaveBeenCalledTimes(1);
    expect(onChar).toHaveBeenCalledWith("t");
  });

  it("calls onSkip for Ctrl+Enter and Meta+Enter", () => {
    const { onSkip, onChar } = setup();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(onSkip).toHaveBeenCalledTimes(2);
    expect(onChar).not.toHaveBeenCalled();
  });

  it("calls onPause for Escape", () => {
    const { onPause } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("ignores events while composing (AC-16)", () => {
    const { onChar, onSkip, onPause } = setup();
    fireEvent.keyDown(window, { key: "a", isComposing: true });
    fireEvent.keyDown(window, { key: "Process", keyCode: 229 });
    expect(onChar).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
  });

  it("ignores Tab and Ctrl+A", () => {
    const { onChar } = setup();
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(onChar).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const { onChar, onPause } = setup({ enabled: false });
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onChar).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
  });

  it("prevents default for handled keys but not for ignored ones", () => {
    setup();
    const handled = new KeyboardEvent("keydown", { key: " ", cancelable: true });
    window.dispatchEvent(handled);
    expect(handled.defaultPrevented).toBe(true);
    const ignored = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    window.dispatchEvent(ignored);
    expect(ignored.defaultPrevented).toBe(false);
  });

  it("uses the latest callbacks without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const addSpy = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(({ onChar }) => useKeyboard({ enabled: true, onChar }), {
      initialProps: { onChar: first },
    });
    const subscriptions = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
    rerender({ onChar: second });
    fireEvent.keyDown(window, { key: "x" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("x");
    expect(addSpy.mock.calls.filter(([type]) => type === "keydown").length).toBe(subscriptions);
    addSpy.mockRestore();
  });

  it("only handles events when the target element has focus", () => {
    const onChar = vi.fn();
    function Game() {
      const ref = useRef<HTMLDivElement>(null);
      useKeyboard({ enabled: true, onChar, target: ref });
      return (
        <div>
          <div ref={ref} tabIndex={0} data-testid="game">
            <button data-testid="inner">inner</button>
          </div>
          <button data-testid="outside">outside</button>
        </div>
      );
    }
    const { getByTestId } = render(<Game />);
    getByTestId("outside").focus();
    fireEvent.keyDown(getByTestId("game"), { key: "a" });
    expect(onChar).not.toHaveBeenCalled();

    getByTestId("game").focus();
    fireEvent.keyDown(getByTestId("game"), { key: "b" });
    expect(onChar).toHaveBeenCalledWith("b");

    getByTestId("inner").focus();
    fireEvent.keyDown(getByTestId("inner"), { key: "c" });
    expect(onChar).toHaveBeenCalledWith("c");
  });
});
