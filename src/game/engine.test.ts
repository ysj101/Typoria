import { beforeEach, describe, expect, it, vi } from "vitest";
import { COUNTDOWN_MS, GAME_DURATION_MS, type Question } from "../types/game";
import { createEngine, type EngineEvent, type GameEngine } from "./engine";
import { createQuestionPicker, createSeededRng } from "./questions";

const QUESTIONS: Question[] = [
  {
    id: "normal-001",
    type: "word",
    difficulty: "normal",
    japanese: "りんご",
    english: "apple",
    answer: "apple",
    tags: ["noun"],
  },
  {
    id: "normal-002",
    type: "fill_blank",
    difficulty: "normal",
    japanese: "私は学生です",
    english: "I _____ a student.",
    answer: "am",
    tags: ["be-verb"],
  },
  {
    id: "normal-003",
    type: "word",
    difficulty: "normal",
    japanese: "ねこ",
    english: "cat",
    answer: "cat",
    tags: ["noun"],
  },
  {
    id: "normal-004",
    type: "fill_blank",
    difficulty: "normal",
    japanese: "走らないで",
    english: "_____ run.",
    answer: "Don't",
    tags: ["imperative"],
  },
];

function setup(opts: { difficulty?: "easy" | "normal" | "hard" } = {}) {
  let t = 1_000;
  const now = () => t;
  const advance = (ms: number) => {
    t += ms;
  };
  const picker = createQuestionPicker({
    questions: QUESTIONS,
    difficulty: opts.difficulty ?? "normal",
    rng: createSeededRng(1),
  });
  const events: EngineEvent[] = [];
  const engine = createEngine({
    picker,
    difficulty: opts.difficulty ?? "normal",
    now,
    generateId: () => "s-1",
    wallClock: () => "2026-10-13T10:00:00.000Z",
  });
  engine.onEvent((e) => events.push(e));
  return { engine, advance, now, events };
}

/** COUNTDOWN を抜けて PLAYING にする */
function startPlaying(engine: GameEngine, advance: (ms: number) => void) {
  engine.start();
  advance(COUNTDOWN_MS);
  engine.tick();
  expect(engine.getSnapshot().state).toBe("PLAYING");
}

function typeAnswer(engine: GameEngine) {
  const answer = engine.getSnapshot().question!.answer;
  for (const ch of answer) engine.input(ch);
}

describe("state machine (§13.1)", () => {
  it("starts in IDLE and moves to COUNTDOWN on start()", () => {
    const { engine } = setup();
    expect(engine.getSnapshot().state).toBe("IDLE");
    engine.start();
    expect(engine.getSnapshot().state).toBe("COUNTDOWN");
    expect(engine.getSnapshot().countdownRemainingMs).toBe(COUNTDOWN_MS);
  });

  it("counts down 3 seconds then starts PLAYING with a question (AC-01)", () => {
    const { engine, advance } = setup();
    engine.start();
    advance(1_000);
    engine.tick();
    expect(engine.getSnapshot().state).toBe("COUNTDOWN");
    expect(engine.getSnapshot().countdownRemainingMs).toBe(2_000);
    advance(2_000);
    engine.tick();
    const s = engine.getSnapshot();
    expect(s.state).toBe("PLAYING");
    expect(s.question).not.toBeNull();
    expect(s.typing?.answer).toBe(s.question?.answer);
    expect(s.questionIndex).toBe(1);
    expect(s.remainingMs).toBe(GAME_DURATION_MS);
  });

  it("finishes after 90 seconds (AC-02)", () => {
    const { engine, advance } = setup();
    startPlaying(engine, advance);
    advance(GAME_DURATION_MS - 1);
    engine.tick();
    expect(engine.getSnapshot().state).toBe("PLAYING");
    expect(engine.getSnapshot().remainingMs).toBe(1);
    advance(1);
    engine.tick();
    expect(engine.getSnapshot().state).toBe("FINISHED");
    expect(engine.getSnapshot().remainingMs).toBe(0);
    engine.toResult();
    expect(engine.getSnapshot().state).toBe("RESULT");
  });

  it("ignores input, skip and pause outside PLAYING", () => {
    const { engine } = setup();
    engine.input("a");
    engine.skip();
    engine.pause();
    engine.resume();
    expect(engine.getSnapshot().state).toBe("IDLE");
    expect(engine.getSnapshot().eventSeq).toBe(0);
  });
});

describe("pause (§3.5, AC-15)", () => {
  it("does not advance time while paused", () => {
    const { engine, advance } = setup();
    startPlaying(engine, advance);
    advance(10_000);
    engine.tick();
    engine.pause();
    expect(engine.getSnapshot().state).toBe("PAUSED");
    advance(30_000);
    engine.tick();
    expect(engine.getSnapshot().remainingMs).toBe(GAME_DURATION_MS - 10_000);
    engine.resume();
    expect(engine.getSnapshot().state).toBe("PLAYING");
    advance(5_000);
    engine.tick();
    expect(engine.getSnapshot().remainingMs).toBe(GAME_DURATION_MS - 15_000);
  });

  it("excludes paused time from question durationMs", () => {
    const { engine, advance } = setup();
    startPlaying(engine, advance);
    advance(2_000);
    engine.pause();
    advance(50_000);
    engine.resume();
    advance(1_000);
    typeAnswer(engine);
    advance(GAME_DURATION_MS);
    engine.tick();
    expect(engine.getSession()?.results[0]?.durationMs).toBe(3_000);
  });
});

describe("typing, combo and score (§3.2, §6, AC-03〜AC-07)", () => {
  let engine: GameEngine;
  let advance: (ms: number) => void;
  let events: EngineEvent[];
  beforeEach(() => {
    ({ engine, advance, events } = setup());
    startPlaying(engine, advance);
  });

  it("advances the cursor on correct input and not on incorrect input", () => {
    const first = engine.getSnapshot().question!.answer[0]!;
    const wrong = first === "z" ? "x" : "z";
    engine.input(wrong);
    expect(engine.getSnapshot().typing?.cursor).toBe(0);
    expect(engine.getSnapshot().incorrectKeystrokes).toBe(1);
    engine.input(first);
    expect(engine.getSnapshot().typing?.cursor).toBe(1);
    expect(engine.getSnapshot().correctKeystrokes).toBe(1);
    expect(events.map((e) => e.type)).toEqual(["countdown", "start", "incorrect", "correct"]);
  });

  it("moves to the next question on completion and adds score with combo", () => {
    const q1 = engine.getSnapshot().question!;
    typeAnswer(engine);
    const s = engine.getSnapshot();
    expect(s.solved).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.perfectSolved).toBe(1);
    expect(s.score).toBe(150 + 30); // normal, combo 1, PERFECT
    expect(s.lastScoreGain).toBe(180);
    expect(s.question?.id).not.toBe(q1.id);
    expect(s.questionIndex).toBe(2);
    expect(s.typing?.cursor).toBe(0);
    const clear = events.find((e) => e.type === "clear");
    expect(clear).toEqual({
      type: "clear",
      perfect: true,
      score: 180,
      combo: 1,
      questionId: q1.id,
    });
  });

  it("resets combo on an incorrect keystroke and on skip", () => {
    typeAnswer(engine);
    typeAnswer(engine);
    expect(engine.getSnapshot().combo).toBe(2);
    const first = engine.getSnapshot().question!.answer[0]!;
    engine.input(first === "z" ? "x" : "z");
    expect(engine.getSnapshot().combo).toBe(0);
    expect(engine.getSnapshot().maxCombo).toBe(2);
    typeAnswer(engine);
    expect(engine.getSnapshot().combo).toBe(1);
    engine.skip();
    expect(engine.getSnapshot().combo).toBe(0);
    expect(engine.getSnapshot().skipped).toBe(1);
  });

  it("records a skipped question as unsolved and never re-asks it in the session", () => {
    const skippedId = engine.getSnapshot().question!.id;
    engine.skip();
    const seen = new Set<string>();
    // 残り 3 問を使い切るまでは再出題されない（使い切った後の再利用は §13.3 で許容）
    for (let i = 0; i < 3; i += 1) {
      seen.add(engine.getSnapshot().question!.id);
      typeAnswer(engine);
    }
    expect(seen.has(skippedId)).toBe(false);
    engine.abort();
    expect(engine.getSession()?.results[0]).toMatchObject({
      questionId: skippedId,
      status: "skipped",
      perfect: false,
    });
  });

  it("enters FEVER at 10 combo and leaves it when the combo resets (AC-08)", () => {
    for (let i = 0; i < 9; i += 1) typeAnswer(engine);
    expect(engine.getSnapshot().fever).toBe(false);
    typeAnswer(engine);
    expect(engine.getSnapshot().fever).toBe(true);
    expect(events.some((e) => e.type === "fever_start")).toBe(true);
    engine.skip();
    expect(engine.getSnapshot().fever).toBe(false);
    expect(events.at(-1)?.type).toBe("fever_end");
  });

  it("applies the combo multiplier (10th combo, normal, PERFECT → 255)", () => {
    for (let i = 0; i < 9; i += 1) typeAnswer(engine);
    const before = engine.getSnapshot().score;
    typeAnswer(engine);
    expect(engine.getSnapshot().score - before).toBe(255);
  });

  it("does not count a non-perfect clear as PERFECT", () => {
    const first = engine.getSnapshot().question!.answer[0]!;
    engine.input(first === "z" ? "x" : "z");
    typeAnswer(engine);
    expect(engine.getSnapshot().perfectSolved).toBe(0);
    expect(engine.getSnapshot().score).toBe(150);
  });
});

describe("session (§12.2)", () => {
  it("builds a GameSession with results and xp when finished", () => {
    const { engine, advance } = setup();
    startPlaying(engine, advance);
    advance(2_500);
    typeAnswer(engine);
    engine.skip();
    advance(1_000);
    engine.input(engine.getSnapshot().question!.answer[0]!);
    advance(GAME_DURATION_MS);
    engine.tick();
    const session = engine.getSession();
    expect(session).not.toBeNull();
    expect(session).toMatchObject({
      id: "s-1",
      startedAt: "2026-10-13T10:00:00.000Z",
      completedAt: "2026-10-13T10:00:00.000Z",
      difficulty: "normal",
      solved: 1,
      skipped: 1,
      perfectSolved: 1,
      maxCombo: 1,
      xpEarned: 20 + 5 + 2,
    });
    expect(session?.results.map((r) => r.status)).toEqual(["solved", "skipped", "timeout"]);
    expect(session?.results[0]?.durationMs).toBe(2_500);
    expect(session?.results[2]?.correctKeystrokes).toBe(1);
  });

  it("abort() yields completedAt null and zero xp", () => {
    const { engine, advance, events } = setup();
    startPlaying(engine, advance);
    typeAnswer(engine);
    engine.abort();
    expect(engine.getSnapshot().state).toBe("FINISHED");
    const session = engine.getSession();
    expect(session?.completedAt).toBeNull();
    expect(session?.xpEarned).toBe(0);
    expect(session?.solved).toBe(1);
    expect(events.at(-1)).toEqual({ type: "finish", aborted: true });
  });

  it("getSession() is null before finishing", () => {
    const { engine, advance } = setup();
    startPlaying(engine, advance);
    expect(engine.getSession()).toBeNull();
  });
});

describe("subscribe / getSnapshot", () => {
  it("notifies listeners and returns a new snapshot object per change", () => {
    const { engine, advance } = setup();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    const before = engine.getSnapshot();
    engine.start();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).not.toBe(before);
    expect(engine.getSnapshot()).toBe(engine.getSnapshot());
    unsubscribe();
    advance(COUNTDOWN_MS);
    engine.tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
