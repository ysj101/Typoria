import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useVisualViewport } from "./useVisualViewport";

describe("useVisualViewport", () => {
  const previous = Object.getOwnPropertyDescriptor(window, "visualViewport");

  afterEach(() => {
    if (previous) Object.defineProperty(window, "visualViewport", previous);
    else delete (window as { visualViewport?: VisualViewport }).visualViewport;
    document.documentElement.style.removeProperty("--vvh");
    document.documentElement.style.removeProperty("--vv-top");
  });

  it("publishes visualViewport size and compacts short heights", () => {
    const listeners = new Map<string, () => void>();
    const vv = {
      height: 390,
      offsetTop: 12,
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });

    const { result, unmount } = renderHook(() => useVisualViewport());
    expect(result.current.compact).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("390px");
    expect(document.documentElement.style.getPropertyValue("--vv-top")).toBe("12px");

    vv.height = 844;
    vv.offsetTop = 0;
    act(() => listeners.get("resize")?.());
    expect(result.current.compact).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("844px");

    unmount();
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--vv-top")).toBe("");
  });
});
