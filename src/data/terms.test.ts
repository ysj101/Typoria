import { describe, expect, it } from "vitest";
import { createSeededRng } from "../game/questions";
import {
  TERM_CATEGORIES,
  TERM_CATEGORY_LABELS,
  TERM_EXPLANATION_MAX_CHARS,
  TERM_EXPLANATION_MIN_CHARS,
  TERM_TYPING_TEXT_MAX_CHARS,
  type Term,
  type TermCategory,
} from "../types/term";
import { TERMS, TERMS_PER_ROUND, parseTerms, selectTerms } from "./terms";

const ASCII_PRINTABLE = /^[\x20-\x7E]+$/;
const JAPANESE_CHAR = /[\u3040-\u30ff\u3400-\u9fff]/;

function validRaw(id = "ai-001", overrides: Record<string, unknown> = {}) {
  const category = id.slice(0, id.lastIndexOf("-"));
  return {
    id,
    category,
    level: 1,
    name: "用語",
    explanation: "あ".repeat(TERM_EXPLANATION_MIN_CHARS),
    typingText: "sample term explains one idea",
    quiz: {
      question: "質問",
      choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      answerIndex: 0,
      explanation: "解説",
    },
    ...overrides,
  };
}

function term(id: string, category: TermCategory): Term {
  return {
    id,
    category,
    level: 1,
    name: id,
    explanation: "あ".repeat(TERM_EXPLANATION_MIN_CHARS),
    typingText: "sample term explains one idea",
    quiz: {
      question: "質問",
      choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      answerIndex: 0,
      explanation: "解説",
    },
  };
}

describe("TERM_CATEGORY_LABELS", () => {
  it("gives every category a display name", () => {
    expect(TERM_CATEGORIES).toEqual([
      "ai",
      "cloud",
      "security",
      "network",
      "web",
      "database",
      "dev",
    ]);
    expect(Object.keys(TERM_CATEGORY_LABELS).sort()).toEqual([...TERM_CATEGORIES].sort());
    expect(TERM_CATEGORY_LABELS).toEqual({
      ai: "AI",
      cloud: "クラウド",
      security: "セキュリティ",
      network: "ネットワーク",
      web: "Web",
      database: "データベース",
      dev: "開発基礎",
    });
  });
});

describe("terms.json", () => {
  it("has at least 35 terms and at least 5 in every category", () => {
    expect(TERMS.length).toBeGreaterThanOrEqual(35);
    for (const category of TERM_CATEGORIES) {
      const count = TERMS.filter((term) => term.category === category).length;
      expect(count, category).toBeGreaterThanOrEqual(5);
    }
  });

  it("has unique ids in {category}-{nnn} form matching the category", () => {
    const ids = TERMS.map((term) => term.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const term of TERMS) {
      expect(term.id, term.id).toMatch(new RegExp(`^${term.category}-\\d{3}$`));
    }
  });

  it("uses level 1, 2, or 3 and a Japanese explanation of 120 to 200 characters", () => {
    for (const term of TERMS) {
      expect([1, 2, 3], term.id).toContain(term.level);
      expect(term.name.trim(), term.id).not.toBe("");
      const chars = [...term.explanation].length;
      expect(chars, term.id).toBeGreaterThanOrEqual(TERM_EXPLANATION_MIN_CHARS);
      expect(chars, term.id).toBeLessThanOrEqual(TERM_EXPLANATION_MAX_CHARS);
      expect(term.explanation, term.id).toMatch(JAPANESE_CHAR);
      expect(term.quiz.question, term.id).toMatch(JAPANESE_CHAR);
      expect(term.quiz.explanation, term.id).toMatch(JAPANESE_CHAR);
    }
  });

  it("uses printable ASCII typing text of at most 80 characters", () => {
    for (const term of TERMS) {
      expect(term.typingText, term.id).toMatch(ASCII_PRINTABLE);
      expect(term.typingText, term.id).toMatch(/[A-Za-z]/);
      expect(term.typingText.length, term.id).toBeLessThanOrEqual(TERM_TYPING_TEXT_MAX_CHARS);
      expect(term.typingText, term.id).toBe(term.typingText.trim());
    }
  });

  it("has 4 unique choices and an answerIndex inside that range", () => {
    for (const term of TERMS) {
      expect(term.quiz.choices, term.id).toHaveLength(4);
      expect(new Set(term.quiz.choices).size, term.id).toBe(4);
      expect(term.quiz.answerIndex, term.id).toBeGreaterThanOrEqual(0);
      expect(term.quiz.answerIndex, term.id).toBeLessThan(4);
      expect(term.quiz.choices[term.quiz.answerIndex], term.id).toBeTruthy();
    }
  });

  it("points related ids at other existing terms", () => {
    const ids = new Set(TERMS.map((term) => term.id));
    for (const term of TERMS) {
      expect(term.related?.length ?? 0, term.id).toBeGreaterThan(0);
      for (const relatedId of term.related ?? []) {
        expect(ids.has(relatedId), `${term.id} -> ${relatedId}`).toBe(true);
        expect(relatedId, term.id).not.toBe(term.id);
      }
      expect(new Set(term.related).size, term.id).toBe(term.related?.length);
    }
  });
});

describe("parseTerms", () => {
  it("accepts a term without related ids", () => {
    const [parsed] = parseTerms([validRaw()]);
    expect(parsed?.id).toBe("ai-001");
    expect(parsed?.related).toBeUndefined();
  });

  it("resolves related ids independently of declaration order", () => {
    const parsed = parseTerms([
      validRaw("ai-001", { related: ["ai-002"] }),
      validRaw("ai-002", { related: ["ai-001"] }),
    ]);
    expect(parsed.map((term) => term.id)).toEqual(["ai-001", "ai-002"]);
  });

  it("rejects data that breaks the term contract", () => {
    expect(() => parseTerms({})).toThrow(/expected an array/);
    expect(() => parseTerms([validRaw(), validRaw()])).toThrow(/duplicate id/);
    expect(() => parseTerms([validRaw("ai-1")])).toThrow(/\{category\}-\{nnn\}/);
    expect(() => parseTerms([validRaw("cloud-001", { category: "ai" })])).toThrow(
      /id prefix must match category/,
    );
    expect(() => parseTerms([validRaw("ai-001", { level: 4 })])).toThrow(/level/);
    expect(() =>
      parseTerms([
        validRaw("ai-001", { explanation: "あ".repeat(TERM_EXPLANATION_MIN_CHARS - 1) }),
      ]),
    ).toThrow(/explanation must be/);
    expect(() =>
      parseTerms([
        validRaw("ai-001", { explanation: "あ".repeat(TERM_EXPLANATION_MAX_CHARS + 1) }),
      ]),
    ).toThrow(/explanation must be/);
    expect(() => parseTerms([validRaw("ai-001", { explanation: "a".repeat(120) })])).toThrow(
      /Japanese/,
    );
    expect(() => parseTerms([validRaw("ai-001", { typingText: "ロードバランサ" })])).toThrow(
      /printable ASCII/,
    );
    expect(() =>
      parseTerms([
        validRaw("ai-001", { typingText: `a${"b".repeat(TERM_TYPING_TEXT_MAX_CHARS)}` }),
      ]),
    ).toThrow(/at most 80/);
    expect(() =>
      parseTerms([
        validRaw("ai-001", {
          quiz: {
            question: "質問",
            choices: ["A", "B", "C"],
            answerIndex: 0,
            explanation: "解説",
          },
        }),
      ]),
    ).toThrow(/exactly 4/);
    expect(() =>
      parseTerms([
        validRaw("ai-001", {
          quiz: {
            question: "質問",
            choices: ["A", "B", "C", "D"],
            answerIndex: 4,
            explanation: "解説",
          },
        }),
      ]),
    ).toThrow(/answerIndex/);
    expect(() => parseTerms([validRaw("ai-001", { related: ["ai-999"] })])).toThrow(
      /related id not found/,
    );
    expect(() => parseTerms([validRaw("ai-001", { related: ["ai-001"] })])).toThrow(/own id/);
  });
});

describe("selectTerms", () => {
  const mixed = [
    term("ai-001", "ai"),
    term("cloud-001", "cloud"),
    term("security-001", "security"),
    term("web-001", "web"),
  ];

  it("defaults to 3 terms and does not repeat them", () => {
    const picked = selectTerms({ rng: createSeededRng(1) });
    expect(TERMS_PER_ROUND).toBe(3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((item) => item.id)).size).toBe(3);
  });

  it("filters by category and does not repeat terms", () => {
    for (const category of TERM_CATEGORIES) {
      const pool = TERMS.filter((item) => item.category === category);
      const picked = selectTerms({
        category,
        count: pool.length,
        rng: createSeededRng(4),
      });
      expect(picked.every((item) => item.category === category)).toBe(true);
      expect(picked.map((item) => item.id).sort()).toEqual(pool.map((item) => item.id).sort());
    }

    expect(
      selectTerms({ terms: mixed, category: "cloud", count: 1, rng: () => 0 }).map(
        (item) => item.id,
      ),
    ).toEqual(["cloud-001"]);
  });

  it("draws across categories when category is omitted", () => {
    const picked = selectTerms({ terms: mixed, count: 3, rng: () => 0 });
    expect(new Set(picked.map((item) => item.category)).size).toBe(3);
    expect(new Set(picked.map((item) => item.id)).size).toBe(3);
  });

  it("is reproducible for a seeded rng and does not mutate the pool", () => {
    const first = selectTerms({ rng: createSeededRng(42) }).map((item) => item.id);
    const second = selectTerms({ rng: createSeededRng(42) }).map((item) => item.id);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);

    const snapshot = mixed.map((item) => item.id);
    expect(selectTerms({ terms: mixed, count: 2, rng: () => 0.99 }).map((item) => item.id)).toEqual(
      ["web-001", "ai-001"],
    );
    expect(mixed.map((item) => item.id)).toEqual(snapshot);
  });

  it("rejects a round larger than the available pool", () => {
    expect(() => selectTerms({ category: "ai", count: TERMS.length, rng: () => 0 })).toThrow(
      /available/,
    );
    expect(() => selectTerms({ category: "ops" as TermCategory, rng: () => 0 })).toThrow(
      /unknown category/,
    );
  });
});
