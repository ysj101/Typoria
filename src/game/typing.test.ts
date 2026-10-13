import { describe, expect, it } from "vitest";
import { createTypingState, expectedChar, inputChar, isPerfect, type TypingState } from "./typing";

function typeAll(state: TypingState, chars: string[]) {
  let current = state;
  const results: string[] = [];
  for (const c of chars) {
    const r = inputChar(current, c);
    current = r.state;
    results.push(r.result);
  }
  return { state: current, results };
}

describe("createTypingState", () => {
  it("starts at cursor 0 with no keystrokes", () => {
    expect(createTypingState("cat")).toEqual({
      answer: "cat",
      cursor: 0,
      correctKeystrokes: 0,
      incorrectKeystrokes: 0,
      lastInput: null,
      completed: false,
    });
  });
});

describe("inputChar (§5.2)", () => {
  it("advances the cursor on a correct char", () => {
    const { state, result } = inputChar(createTypingState("cat"), "c");
    expect(result).toBe("correct");
    expect(state.cursor).toBe(1);
    expect(state.correctKeystrokes).toBe(1);
    expect(state.lastInput).toBe("correct");
  });

  it("does not mutate the input state", () => {
    const initial = createTypingState("cat");
    inputChar(initial, "c");
    expect(initial.cursor).toBe(0);
  });

  it("does not advance on an incorrect char and counts it", () => {
    const { state, result } = inputChar(createTypingState("cat"), "x");
    expect(result).toBe("incorrect");
    expect(state.cursor).toBe(0);
    expect(state.incorrectKeystrokes).toBe(1);
    expect(state.lastInput).toBe("incorrect");
  });

  it("allows continuing with the correct char after a miss (AC-04)", () => {
    const { state, results } = typeAll(createTypingState("cat"), ["x", "c", "a", "t"]);
    expect(results).toEqual(["incorrect", "correct", "correct", "completed"]);
    expect(state.completed).toBe(true);
    expect(state.incorrectKeystrokes).toBe(1);
    expect(state.correctKeystrokes).toBe(3);
  });

  it("is case-insensitive on both sides", () => {
    expect(inputChar(createTypingState("Apple"), "a").result).toBe("correct");
    expect(inputChar(createTypingState("apple"), "A").result).toBe("correct");
  });

  it("accepts Space only where the answer has a space ('I am')", () => {
    const { state, results } = typeAll(createTypingState("I am"), [" ", "i", " ", "a", "m"]);
    expect(results).toEqual(["incorrect", "correct", "correct", "correct", "completed"]);
    expect(state.completed).toBe(true);
    expect(state.incorrectKeystrokes).toBe(1);
  });

  it('accepts an apostrophe only where the answer has one ("don\'t")', () => {
    const { results } = typeAll(createTypingState("don't"), ["d", "o", "n", "'", "t"]);
    expect(results).toEqual(["correct", "correct", "correct", "correct", "completed"]);
    expect(inputChar(createTypingState("don't"), "'").result).toBe("incorrect");
  });

  it("treats a symbol not in the answer as incorrect", () => {
    expect(inputChar(createTypingState("cat"), "!").result).toBe("incorrect");
  });

  it("ignores Backspace and other control keys without changing state", () => {
    const after = inputChar(createTypingState("cat"), "c").state;
    for (const key of ["Backspace", "Enter", "Shift", "Tab", "Escape", "ArrowLeft", ""]) {
      const { state, result } = inputChar(after, key);
      expect(result).toBe("ignored");
      expect(state).toBe(after);
    }
  });

  it("ignores multi-character strings", () => {
    const { state, result } = inputChar(createTypingState("cat"), "ca");
    expect(result).toBe("ignored");
    expect(state.cursor).toBe(0);
  });

  it("returns completed on the final correct char and ignores further input", () => {
    const { state } = typeAll(createTypingState("hi"), ["h", "i"]);
    expect(state.completed).toBe(true);
    expect(state.cursor).toBe(2);
    const next = inputChar(state, "x");
    expect(next.result).toBe("ignored");
    expect(next.state).toBe(state);
  });
});

describe("isPerfect (§5.3)", () => {
  it("is true only when completed with zero incorrect keystrokes", () => {
    const perfect = typeAll(createTypingState("go"), ["g", "o"]).state;
    expect(isPerfect(perfect)).toBe(true);
    const missed = typeAll(createTypingState("go"), ["x", "g", "o"]).state;
    expect(isPerfect(missed)).toBe(false);
    const partial = inputChar(createTypingState("go"), "g").state;
    expect(isPerfect(partial)).toBe(false);
  });
});

describe("expectedChar", () => {
  it("returns the char at the cursor, or null when completed", () => {
    const s = createTypingState("I am");
    expect(expectedChar(s)).toBe("I");
    expect(expectedChar(inputChar(s, "i").state)).toBe(" ");
    const done = typeAll(s, ["i", " ", "a", "m"]).state;
    expect(expectedChar(done)).toBeNull();
  });
});
