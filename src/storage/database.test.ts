import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  EXPORT_VERSION,
  type DailyMissionProgress,
  type ExportData,
  type GameSession,
  type QuestionStat,
  type UserProgress,
} from "../types/game";
import type { TermProgress } from "../types/term";
import { ImportError, openDatabase, validateExportData } from "./database";

let counter = 0;
const freshDb = () => openDatabase(`typoria-test-${Date.now()}-${counter++}`);

const session = (id: string, startedAt: string): GameSession => ({
  id,
  startedAt,
  completedAt: startedAt,
  difficulty: "normal",
  score: 1000,
  maxCombo: 5,
  solved: 8,
  skipped: 1,
  perfectSolved: 3,
  correctKeystrokes: 40,
  incorrectKeystrokes: 2,
  xpEarned: 66,
  results: [],
});

const stat = (questionId: string): QuestionStat => ({
  questionId,
  attempts: 2,
  solved: 1,
  skipped: 1,
  correctKeystrokes: 10,
  incorrectKeystrokes: 3,
  lastAttemptedAt: "2026-10-13T00:00:00.000Z",
});

const termProgress: TermProgress = {
  termId: "ai-001",
  seenCount: 2,
  quizCorrect: 1,
  quizIncorrect: 1,
  lastStudiedAt: "2026-10-14T09:00:00.000Z",
};

const progress: UserProgress = {
  totalXP: 120,
  totalSessions: 3,
  bestScore: 1500,
  currentStreak: 2,
  longestStreak: 4,
  lastPlayedDate: "2026-10-13",
  currentDifficulty: "hard",
};

describe("database defaults (§2.1)", () => {
  it("returns DEFAULT_PROGRESS and DEFAULT_SETTINGS on first launch", async () => {
    const db = freshDb();
    expect(await db.getProgress()).toEqual(DEFAULT_PROGRESS);
    expect(await db.getSettings()).toEqual(DEFAULT_SETTINGS);
    db.close();
  });

  it("merges partially stored settings with defaults", async () => {
    const db = freshDb();
    await db.putSettings({ ...DEFAULT_SETTINGS, sfxVolume: 10 });
    expect(await db.getSettings()).toEqual({ ...DEFAULT_SETTINGS, sfxVolume: 10 });
    db.close();
  });
});

describe("sessions", () => {
  it("saves and lists sessions newest first with a limit", async () => {
    const db = freshDb();
    await db.saveSession(session("a", "2026-10-11T10:00:00.000Z"));
    await db.saveSession(session("b", "2026-10-13T10:00:00.000Z"));
    await db.saveSession(session("c", "2026-10-12T10:00:00.000Z"));
    const all = await db.listSessions();
    expect(all.map((s) => s.id)).toEqual(["b", "c", "a"]);
    const limited = await db.listSessions({ limit: 2 });
    expect(limited.map((s) => s.id)).toEqual(["b", "c"]);
    db.close();
  });
});

describe("progress / settings / stats / missions", () => {
  it("round-trips progress", async () => {
    const db = freshDb();
    await db.putProgress(progress);
    expect(await db.getProgress()).toEqual(progress);
    db.close();
  });

  it("bulk puts question stats and reads them back", async () => {
    const db = freshDb();
    await db.bulkPutQuestionStats([stat("easy-001"), stat("easy-002")]);
    await db.bulkPutQuestionStats([{ ...stat("easy-001"), attempts: 5 }]);
    const stats = await db.getQuestionStats();
    expect(stats).toHaveLength(2);
    expect((await db.getQuestionStat("easy-001"))?.attempts).toBe(5);
    expect(await db.getQuestionStat("none")).toBeUndefined();
    db.close();
  });

  it("stores daily mission progress by dateKey", async () => {
    const db = freshDb();
    const mission: DailyMissionProgress = {
      dateKey: "2026-10-13",
      missions: [{ id: "play_once", current: 1, completed: true, rewarded: true }],
    };
    await db.putMission(mission);
    expect(await db.getMission("2026-10-13")).toEqual(mission);
    expect(await db.getMission("2026-10-12")).toBeUndefined();
    db.close();
  });
});

describe("export / import (§12.4, AC-19)", () => {
  async function seeded() {
    const db = freshDb();
    await db.saveSession(session("a", "2026-10-11T10:00:00.000Z"));
    await db.putProgress(progress);
    await db.putSettings({ ...DEFAULT_SETTINGS, bgmEnabled: false });
    await db.bulkPutQuestionStats([stat("easy-001")]);
    await db.putTermProgress([termProgress]);
    return db;
  }

  it("exports an envelope with version and exportedAt", async () => {
    const db = await seeded();
    const data = await db.exportData(() => new Date("2026-10-13T12:00:00.000Z"));
    expect(data.version).toBe(EXPORT_VERSION);
    expect(data.exportedAt).toBe("2026-10-13T12:00:00.000Z");
    expect(data.progress).toEqual(progress);
    expect(data.sessions).toHaveLength(1);
    expect(data.questionStats).toHaveLength(1);
    expect(data.settings.bgmEnabled).toBe(false);
    expect(data.termProgress).toEqual([termProgress]);
    db.close();
  });

  it("round-trips export → import into another database, replacing everything", async () => {
    const source = await seeded();
    const exported = await source.exportData();
    const target = freshDb();
    await target.saveSession(session("zzz", "2026-01-01T00:00:00.000Z"));
    await target.importData(JSON.parse(JSON.stringify(exported)));
    expect(await target.exportData()).toMatchObject({
      progress: exported.progress,
      sessions: exported.sessions,
      questionStats: exported.questionStats,
      settings: exported.settings,
      termProgress: exported.termProgress,
    });
    expect((await target.listSessions()).map((s) => s.id)).toEqual(["a"]);
    source.close();
    target.close();
  });

  it.each([
    ["wrong version", (d: ExportData) => ({ ...d, version: 99 })],
    ["missing progress", (d: ExportData) => ({ ...d, progress: undefined })],
    ["sessions not array", (d: ExportData) => ({ ...d, sessions: "nope" })],
    ["termProgress not an array", (d: ExportData) => ({ ...d, termProgress: "nope" })],
    ["not an object", () => "garbage"],
  ])("rejects %s and keeps existing data", async (_name, mutate) => {
    const db = await seeded();
    const valid = await db.exportData();
    const bad = mutate(valid) as unknown;
    expect(validateExportData(bad).ok).toBe(false);
    await expect(db.importData(bad)).rejects.toBeInstanceOf(ImportError);
    expect(await db.getProgress()).toEqual(progress);
    expect(await db.listSessions()).toHaveLength(1);
    expect(await db.listTermProgress()).toEqual([termProgress]);
    db.close();
  });

  it("imports a legacy envelope with no termProgress as an empty learning record", async () => {
    const db = await seeded();
    const exported = await db.exportData();
    const legacy = { ...exported };
    delete (legacy as { termProgress?: TermProgress[] }).termProgress;
    await db.importData(legacy);
    expect(await db.listTermProgress()).toEqual([]);
    expect(await db.getProgress()).toEqual(progress);
    db.close();
  });

  it("rejects a termProgress row with a fractional count and keeps stored rows", async () => {
    const db = await seeded();
    const exported = await db.exportData();
    const bad = {
      ...exported,
      termProgress: [{ ...termProgress, seenCount: 1.5 }],
    };
    expect(validateExportData(bad).ok).toBe(false);
    await expect(db.importData(bad)).rejects.toBeInstanceOf(ImportError);
    expect(await db.listTermProgress()).toEqual([termProgress]);
    db.close();
  });

  it("validateExportData accepts a valid envelope", async () => {
    const db = await seeded();
    const result = validateExportData(await db.exportData());
    expect(result.ok).toBe(true);
    db.close();
  });
});

describe("migration from v1", () => {
  it("adds termProgress and keeps sessions, progress, and settings", async () => {
    const name = `typoria-migrate-${Date.now()}-${counter++}`;
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("startedAt", "startedAt");
        db.createObjectStore("progress");
        db.createObjectStore("settings");
        db.createObjectStore("questionStats", { keyPath: "questionId" });
        db.createObjectStore("dailyMissions", { keyPath: "dateKey" });
      },
    });
    await v1.put("sessions", session("keep", "2026-10-11T10:00:00.000Z"));
    await v1.put("progress", progress, "progress");
    await v1.put("settings", { ...DEFAULT_SETTINGS, sfxVolume: 12 }, "settings");
    v1.close();

    const migrated = openDatabase(name);
    expect((await migrated.listSessions()).map((item) => item.id)).toEqual(["keep"]);
    expect(await migrated.getProgress()).toEqual(progress);
    expect((await migrated.getSettings()).sfxVolume).toBe(12);
    expect(await migrated.listTermProgress()).toEqual([]);
    await migrated.putTermProgress([termProgress]);
    expect(await migrated.listTermProgress()).toEqual([termProgress]);
    expect((await migrated.listSessions()).map((item) => item.id)).toEqual(["keep"]);
    migrated.close();
  });
});

describe("clearAll", () => {
  it("removes every store", async () => {
    const db = freshDb();
    await db.saveSession(session("a", "2026-10-11T10:00:00.000Z"));
    await db.putProgress(progress);
    await db.clearAll();
    expect(await db.listSessions()).toEqual([]);
    expect(await db.getProgress()).toEqual(DEFAULT_PROGRESS);
    db.close();
  });
});
