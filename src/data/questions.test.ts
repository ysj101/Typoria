import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty, type Question } from "../types/game";
import { QUESTIONS, getQuestionsByDifficulty } from "./questions";

const ANSWER_PATTERN = /^[A-Za-z][A-Za-z' .,!?-]*$/;
const ID_PATTERN = /^(easy|normal|hard)-\d{3}$/;
const TAG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BLANK = "_____";

const count = (list: Question[], pred: (q: Question) => boolean) => list.filter(pred).length;

describe("questions.json (§5.1, §7.1, §12.1)", () => {
  it("has 150 questions in total", () => {
    expect(QUESTIONS).toHaveLength(150);
  });

  it("has unique ids in `{difficulty}-{nnn}` format matching their difficulty", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) {
      expect(q.id).toMatch(ID_PATTERN);
      expect(q.id.startsWith(`${q.difficulty}-`)).toBe(true);
    }
  });

  it.each(DIFFICULTIES)("has 50 questions for %s (15 word / 35 fill_blank)", (d) => {
    const list = getQuestionsByDifficulty(d);
    expect(list).toHaveLength(50);
    expect(count(list, (q) => q.type === "word")).toBe(15);
    expect(count(list, (q) => q.type === "fill_blank")).toBe(35);
    expect(list.every((q) => q.difficulty === d)).toBe(true);
  });

  it("only uses allowed characters in answer", () => {
    for (const q of QUESTIONS) {
      expect(q.answer, q.id).toMatch(ANSWER_PATTERN);
      expect(q.answer, q.id).toBe(q.answer.trim());
    }
  });

  it("has exactly one blank in fill_blank english and none in word", () => {
    for (const q of QUESTIONS) {
      const blanks = q.english.split(BLANK).length - 1;
      expect(blanks, q.id).toBe(q.type === "fill_blank" ? 1 : 0);
      expect(q.english.replace(BLANK, ""), q.id).not.toContain("_");
    }
  });

  it("uses the same text for english and answer in word questions", () => {
    for (const q of QUESTIONS.filter((x) => x.type === "word")) {
      expect(q.english, q.id).toBe(q.answer);
    }
  });

  it("produces a sentence without blanks when answer fills the blank", () => {
    for (const q of QUESTIONS.filter((x) => x.type === "fill_blank")) {
      const filled = q.english.replace(BLANK, q.answer);
      expect(filled, q.id).not.toContain("_");
      expect(filled, q.id).not.toMatch(/\s{2}/);
    }
  });

  it("has non-empty japanese and at least one kebab-case tag", () => {
    for (const q of QUESTIONS) {
      expect(q.japanese.trim().length, q.id).toBeGreaterThan(0);
      expect(q.tags.length, q.id).toBeGreaterThan(0);
      for (const t of q.tags) expect(t, q.id).toMatch(TAG_PATTERN);
    }
  });

  it("does not repeat answers within a difficulty", () => {
    for (const d of DIFFICULTIES) {
      const answers = getQuestionsByDifficulty(d).map((q) => q.answer.toLowerCase());
      expect(new Set(answers).size, d).toBe(answers.length);
    }
  });

  it("returns an empty list for an unknown difficulty", () => {
    expect(getQuestionsByDifficulty("unknown" as Difficulty)).toEqual([]);
  });
});
