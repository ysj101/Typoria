import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScorePopupLayer } from "./ScorePopup";

describe("ScorePopupLayer (§9.1)", () => {
  it("renders +score and PERFECT! for perfect clears", () => {
    render(
      <ScorePopupLayer
        popups={[
          { id: 1, score: 150, perfect: false },
          { id: 2, score: 255, perfect: true },
        ]}
      />,
    );
    const popups = screen.getAllByTestId("score-popup");
    expect(popups).toHaveLength(2);
    expect(popups[0]).toHaveTextContent("+150");
    expect(popups[0]).not.toHaveTextContent("PERFECT!");
    expect(popups[0]).toHaveAttribute("data-animate", "rise");
    expect(popups[1]).toHaveTextContent("+255");
    expect(popups[1]).toHaveTextContent("PERFECT!");
    expect(popups[1]).toHaveAttribute("data-perfect", "true");
  });

  it("disables the animation when animate is false", () => {
    render(<ScorePopupLayer popups={[{ id: 1, score: 100, perfect: false }]} animate={false} />);
    expect(screen.getByTestId("score-popup")).toHaveAttribute("data-animate", "none");
  });

  it("is hidden from assistive technology", () => {
    render(<ScorePopupLayer popups={[]} />);
    expect(screen.getByTestId("score-popups")).toHaveAttribute("aria-hidden", "true");
  });
});
