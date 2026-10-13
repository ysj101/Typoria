import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PARTICLE_LIMIT, ParticleEffect, type Particle } from "./ParticleEffect";

function particle(id: number, color: Particle["color"] = "correct"): Particle {
  return { id, x: 50, y: 50, dx: 10, dy: -20, size: 5, color };
}

describe("ParticleEffect (§9.1, AC-17)", () => {
  it("renders one element per particle with transform variables", () => {
    render(<ParticleEffect particles={[particle(1), particle(2, "perfect")]} />);
    const items = screen.getAllByTestId("particle");
    expect(items).toHaveLength(2);
    expect(items[0]!.style.getPropertyValue("--fx-dx")).toBe("10px");
    expect(items[1]).toHaveClass("bg-perfect");
    expect(screen.getByTestId("particles")).toHaveAttribute("data-count", "2");
  });

  it("renders nothing with an empty list", () => {
    render(<ParticleEffect particles={[]} />);
    expect(screen.queryAllByTestId("particle")).toHaveLength(0);
  });

  it("exposes a particle cap", () => {
    expect(PARTICLE_LIMIT).toBe(60);
  });
});
