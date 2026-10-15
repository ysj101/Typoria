import { describe, expect, it } from "vitest";
import {
  applyQuizResult,
  applyTermsSeen,
  categoryStudyCounts,
  enqueueTermProgressUpdate,
  selectOmakaseTerms,
  termStudyStatus,
} from "./termProgress";
import { createMemoryStorage } from "../app/storage";
import { makeTerm } from "../test/factories";
import type { TermProgress } from "../types/term";

const term = (id: string) => makeTerm(id, { typingText: "term" });

const AT = "2026-10-14T09:00:00.000Z";
const LATER = "2026-10-14T10:00:00.000Z";

function row(partial: Partial<TermProgress> & Pick<TermProgress, "termId">): TermProgress {
  return {
    seenCount: 0,
    quizCorrect: 0,
    quizIncorrect: 0,
    lastStudiedAt: AT,
    ...partial,
  };
}

describe("termStudyStatus", () => {
  it("is unseen when there is no record", () => {
    expect(termStudyStatus(undefined)).toBe("unseen");
  });

  it("is unseen when every count is zero", () => {
    expect(termStudyStatus(row({ termId: "ai-001" }))).toBe("unseen");
  });

  it("is learning after it was read but the quiz is not yet correct", () => {
    expect(termStudyStatus(row({ termId: "ai-001", seenCount: 1 }))).toBe("learning");
    expect(termStudyStatus(row({ termId: "ai-001", quizIncorrect: 2 }))).toBe("learning");
  });

  it("is mastered after at least one correct quiz", () => {
    expect(
      termStudyStatus(row({ termId: "ai-001", seenCount: 3, quizCorrect: 1, quizIncorrect: 4 })),
    ).toBe("mastered");
    expect(termStudyStatus(row({ termId: "ai-001", quizCorrect: 1 }))).toBe("mastered");
  });
});

describe("applyQuizResult", () => {
  it("records a quiz term that was not in the read list", () => {
    const next = applyQuizResult([], {
      termId: "security-001",
      correct: false,
      answeredAt: AT,
    });
    expect(next).toEqual([row({ termId: "security-001", quizIncorrect: 1 })]);
    expect(termStudyStatus(next[0])).toBe("learning");
  });
});

describe("selectOmakaseTerms", () => {
  const mastered = term("ai-001");
  const learning = term("cloud-001");
  const unseen = term("web-001");
  const progress = [
    row({ termId: mastered.id, seenCount: 2, quizCorrect: 1 }),
    row({ termId: learning.id, seenCount: 1 }),
  ];

  it("picks unseen and in-progress terms before mastered ones", () => {
    const picked = selectOmakaseTerms({
      terms: [mastered, unseen, learning],
      progress,
      count: 2,
      rng: () => 0,
    });
    expect(picked.map((item) => item.id).sort()).toEqual([learning.id, unseen.id]);
  });

  it("fills the rest with mastered terms when unmastered terms run out", () => {
    const secondMastered = term("dev-001");
    const picked = selectOmakaseTerms({
      terms: [mastered, secondMastered, unseen],
      progress: [...progress, row({ termId: secondMastered.id, quizCorrect: 3 })],
      count: 3,
      rng: () => 0,
    });
    const ids = picked.map((item) => item.id);
    expect(ids[0]).toBe(unseen.id);
    expect(ids.slice(1).sort()).toEqual([mastered.id, secondMastered.id]);
  });

  it("still returns a round when every term is mastered", () => {
    const other = term("dev-002");
    const picked = selectOmakaseTerms({
      terms: [mastered, other],
      progress: [
        row({ termId: mastered.id, quizCorrect: 1 }),
        row({ termId: other.id, quizCorrect: 2 }),
      ],
      count: 1,
      rng: () => 0,
    });
    expect(picked).toHaveLength(1);
    expect([mastered.id, other.id]).toContain(picked[0]?.id);
  });
});

describe("categoryStudyCounts", () => {
  it("counts mastered terms against the category total", () => {
    const counts = categoryStudyCounts(
      [term("ai-001"), term("ai-002"), term("web-001")],
      [row({ termId: "ai-001", quizCorrect: 1 }), row({ termId: "ai-002", seenCount: 1 })],
    );
    expect(counts.ai).toEqual({ mastered: 1, total: 2 });
    expect(counts.web).toEqual({ mastered: 0, total: 1 });
    expect(counts.cloud).toEqual({ mastered: 0, total: 0 });
  });
});

describe("enqueueTermProgressUpdate", () => {
  it("applies a later quiz update on top of an in-flight seen update", async () => {
    const memory = createMemoryStorage();
    let releaseFirst: (rows: TermProgress[]) => void = () => {};
    let calls = 0;
    const storage = {
      listTermProgress: () => {
        calls += 1;
        if (calls === 1) {
          return new Promise<TermProgress[]>((resolve) => {
            releaseFirst = resolve;
          });
        }
        return memory.listTermProgress();
      },
      putTermProgress: (records: readonly TermProgress[]) => memory.putTermProgress(records),
    };

    const seen = enqueueTermProgressUpdate(storage, () => [
      row({ termId: "ai-001", seenCount: 1 }),
    ]);
    const quiz = enqueueTermProgressUpdate(storage, (current) =>
      applyQuizResult(current, { termId: "ai-001", correct: true, answeredAt: LATER }),
    );
    await Promise.resolve();
    expect(calls).toBe(1);
    releaseFirst([]);
    await seen;
    await quiz;
    expect(await memory.listTermProgress()).toEqual([
      row({ termId: "ai-001", seenCount: 1, quizCorrect: 1, lastStudiedAt: LATER }),
    ]);
  });

  it("records seen terms and then the quiz result", async () => {
    const storage = createMemoryStorage();
    await enqueueTermProgressUpdate(storage, (current) =>
      applyTermsSeen(current, ["ai-001", "cloud-001"], AT),
    );
    await enqueueTermProgressUpdate(storage, (current) =>
      applyQuizResult(current, { termId: "ai-001", correct: false, answeredAt: LATER }),
    );
    expect(await storage.listTermProgress()).toEqual([
      row({ termId: "ai-001", seenCount: 1, quizIncorrect: 1, lastStudiedAt: LATER }),
      row({ termId: "cloud-001", seenCount: 1 }),
    ]);
  });
});
