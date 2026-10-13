import { describe, expect, it } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("formats remaining ms as mm:ss, rounding up", () => {
    expect(formatTime(90_000)).toBe("01:30");
    expect(formatTime(89_001)).toBe("01:30");
    expect(formatTime(60_000)).toBe("01:00");
    expect(formatTime(999)).toBe("00:01");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(-5)).toBe("00:00");
  });
});
