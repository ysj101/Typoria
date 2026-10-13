import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHAKE_DURATION_MS, useScreenShake } from "./useScreenShake";

describe("useScreenShake (§5.2, §4.5)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets the shake attribute for 120ms", () => {
    const { result } = renderHook(() => useScreenShake("weak"));
    expect(result.current.shakeAttr).toBeUndefined();
    act(() => result.current.shake());
    expect(result.current.shakeAttr).toBe("weak");
    act(() => vi.advanceTimersByTime(SHAKE_DURATION_MS - 1));
    expect(result.current.shakeAttr).toBe("weak");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.shakeAttr).toBeUndefined();
  });

  it("uses the strong level", () => {
    const { result } = renderHook(() => useScreenShake("strong"));
    act(() => result.current.shake());
    expect(result.current.shakeAttr).toBe("strong");
  });

  it("does nothing when the setting is none", () => {
    const { result } = renderHook(() => useScreenShake("none"));
    act(() => result.current.shake());
    expect(result.current.shakeAttr).toBeUndefined();
  });

  it("does nothing under reduced motion", () => {
    const { result } = renderHook(() => useScreenShake("strong", true));
    act(() => result.current.shake());
    expect(result.current.shakeAttr).toBeUndefined();
  });

  it("restarts the timer when shaken again", () => {
    const { result } = renderHook(() => useScreenShake("weak"));
    act(() => result.current.shake());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.shake());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.shakeAttr).toBe("weak");
    act(() => vi.advanceTimersByTime(20));
    expect(result.current.shakeAttr).toBeUndefined();
  });
});
