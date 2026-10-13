import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Background } from "./Background";

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Background", () => {
  it("defaults to normal mode with zero intensity", () => {
    stubReducedMotion(false);
    const { container } = render(<Background />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-mode", "normal");
    expect(root).toHaveAttribute("data-intensity", "0");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-reduced-motion", "false");
  });

  it.each(["normal", "combo", "fever"] as const)("renders mode %s", (mode) => {
    stubReducedMotion(false);
    const { container } = render(<Background mode={mode} />);
    expect(container.firstElementChild).toHaveAttribute("data-mode", mode);
  });

  it("clamps intensity to 0..1", () => {
    stubReducedMotion(false);
    const { container, rerender } = render(<Background intensity={1.7} />);
    expect(container.firstElementChild).toHaveAttribute("data-intensity", "1");
    rerender(<Background intensity={-2} />);
    expect(container.firstElementChild).toHaveAttribute("data-intensity", "0");
  });

  it("renders a deterministic star field", () => {
    stubReducedMotion(false);
    const a = render(<Background />).container.innerHTML;
    const b = render(<Background />).container.innerHTML;
    expect(a).toBe(b);
    expect(a).toContain('data-star="true"');
  });

  it("marks reduced motion when the OS prefers it", () => {
    stubReducedMotion(true);
    const { container } = render(<Background mode="fever" />);
    expect(container.firstElementChild).toHaveAttribute("data-reduced-motion", "true");
  });

  it("marks reduced motion when the app setting forces it", () => {
    stubReducedMotion(false);
    const { container } = render(<Background reducedMotion />);
    expect(container.firstElementChild).toHaveAttribute("data-reduced-motion", "true");
  });
});
