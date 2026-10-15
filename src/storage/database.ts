/**
 * IndexedDB ストレージ層（§12 データモデル、§2.1 データ、§14 オフライン）。
 * 学習データは端末内にのみ保存し、外部サーバーへは送信しない。
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  DIFFICULTIES,
  EXPORT_VERSION,
  type DailyMissionProgress,
  type ExportData,
  type GameSession,
  type QuestionStat,
  type Settings,
  type UserProgress,
} from "../types/game";
import { isTermProgress, type TermProgress } from "../types/term";

const DB_VERSION = 2;
const PROGRESS_KEY = "progress";
const SETTINGS_KEY = "settings";

interface TyporiaSchema extends DBSchema {
  sessions: {
    key: string;
    value: GameSession;
    indexes: { startedAt: string };
  };
  progress: { key: string; value: UserProgress };
  settings: { key: string; value: Settings };
  questionStats: { key: string; value: QuestionStat };
  dailyMissions: { key: string; value: DailyMissionProgress };
  termProgress: { key: string; value: TermProgress };
}

const STORES = [
  "sessions",
  "progress",
  "settings",
  "questionStats",
  "dailyMissions",
  "termProgress",
] as const;

export interface TyporiaDatabase {
  saveSession(session: GameSession): Promise<void>;
  /** startedAt 降順 */
  listSessions(opts?: { limit?: number }): Promise<GameSession[]>;
  getProgress(): Promise<UserProgress>;
  putProgress(progress: UserProgress): Promise<void>;
  getSettings(): Promise<Settings>;
  putSettings(settings: Settings): Promise<void>;
  getQuestionStats(): Promise<QuestionStat[]>;
  getQuestionStat(questionId: string): Promise<QuestionStat | undefined>;
  bulkPutQuestionStats(stats: QuestionStat[]): Promise<void>;
  getMission(dateKey: string): Promise<DailyMissionProgress | undefined>;
  putMission(mission: DailyMissionProgress): Promise<void>;
  /** termId 昇順 */
  listTermProgress(): Promise<TermProgress[]>;
  /** 学習記録をこの配列で置き換える */
  putTermProgress(records: readonly TermProgress[]): Promise<void>;
  exportData(now?: () => Date): Promise<ExportData>;
  /** 検証に失敗した場合は ImportError を投げ、既存データを変更しない */
  importData(json: unknown): Promise<void>;
  clearAll(): Promise<void>;
  close(): void;
}

/** インポート JSON の検証失敗（§12.4） */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

// ---- バリデーション（純関数） ------------------------------------------------

type ValidationResult = { ok: true; data: ExportData } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
const isDifficulty = (v: unknown) => (DIFFICULTIES as readonly unknown[]).includes(v);

function isProgress(v: unknown): v is UserProgress {
  return (
    isObject(v) &&
    isNumber(v.totalXP) &&
    isNumber(v.totalSessions) &&
    isNumber(v.bestScore) &&
    isNumber(v.currentStreak) &&
    isNumber(v.longestStreak) &&
    (v.lastPlayedDate === null || isString(v.lastPlayedDate)) &&
    isDifficulty(v.currentDifficulty)
  );
}

function isSession(v: unknown): v is GameSession {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.startedAt) &&
    (v.completedAt === null || isString(v.completedAt)) &&
    isDifficulty(v.difficulty) &&
    isNumber(v.score) &&
    isNumber(v.maxCombo) &&
    isNumber(v.solved) &&
    isNumber(v.skipped) &&
    isNumber(v.perfectSolved) &&
    isNumber(v.correctKeystrokes) &&
    isNumber(v.incorrectKeystrokes) &&
    isNumber(v.xpEarned) &&
    Array.isArray(v.results)
  );
}

function isQuestionStat(v: unknown): v is QuestionStat {
  return (
    isObject(v) &&
    isString(v.questionId) &&
    isNumber(v.attempts) &&
    isNumber(v.solved) &&
    isNumber(v.skipped) &&
    isNumber(v.correctKeystrokes) &&
    isNumber(v.incorrectKeystrokes) &&
    (v.lastAttemptedAt === null || isString(v.lastAttemptedAt))
  );
}

function isSettings(v: unknown): v is Settings {
  return (
    isObject(v) &&
    isBoolean(v.sfxEnabled) &&
    isNumber(v.sfxVolume) &&
    isBoolean(v.bgmEnabled) &&
    isNumber(v.bgmVolume) &&
    ["none", "weak", "strong"].includes(v.screenShake as string) &&
    isBoolean(v.particles) &&
    (v.difficultyMode === "auto" || isDifficulty(v.difficultyMode))
  );
}

/** エクスポート JSON の envelope を検証する（§12.4） */
export function validateExportData(json: unknown): ValidationResult {
  if (!isObject(json)) return { ok: false, error: "データがオブジェクトではありません" };
  if (json.version !== EXPORT_VERSION) {
    return { ok: false, error: `未対応のバージョンです: ${String(json.version)}` };
  }
  if (!isString(json.exportedAt)) return { ok: false, error: "exportedAt がありません" };
  if (!isProgress(json.progress)) return { ok: false, error: "progress が不正です" };
  if (!Array.isArray(json.sessions) || !json.sessions.every(isSession)) {
    return { ok: false, error: "sessions が不正です" };
  }
  if (!Array.isArray(json.questionStats) || !json.questionStats.every(isQuestionStat)) {
    return { ok: false, error: "questionStats が不正です" };
  }
  if (!isSettings(json.settings)) return { ok: false, error: "settings が不正です" };
  let termProgress: TermProgress[] = [];
  if (json.termProgress !== undefined) {
    if (!Array.isArray(json.termProgress) || !json.termProgress.every(isTermProgress)) {
      return { ok: false, error: "termProgress が不正です" };
    }
    termProgress = json.termProgress;
  }
  return {
    ok: true,
    data: {
      version: EXPORT_VERSION,
      exportedAt: json.exportedAt,
      progress: json.progress,
      sessions: json.sessions,
      questionStats: json.questionStats,
      settings: json.settings,
      termProgress,
    },
  };
}

// ---- DB ------------------------------------------------------------------

/** データベースを遅延オープンして API を返す */
export function openDatabase(name = "typoria"): TyporiaDatabase {
  let dbPromise: Promise<IDBPDatabase<TyporiaSchema>> | null = null;

  const open = () => {
    dbPromise ??= openDB<TyporiaSchema>(name, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const sessions = db.createObjectStore("sessions", { keyPath: "id" });
          sessions.createIndex("startedAt", "startedAt");
          db.createObjectStore("progress");
          db.createObjectStore("settings");
          db.createObjectStore("questionStats", { keyPath: "questionId" });
          db.createObjectStore("dailyMissions", { keyPath: "dateKey" });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("termProgress")) {
          db.createObjectStore("termProgress", { keyPath: "termId" });
        }
      },
    });
    return dbPromise;
  };

  const getProgress = async () =>
    (await (await open()).get("progress", PROGRESS_KEY)) ?? DEFAULT_PROGRESS;
  const getSettings = async (): Promise<Settings> => {
    const stored = await (await open()).get("settings", SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
  };
  const listTermProgress = async () => {
    const rows = await (await open()).getAll("termProgress");
    return rows.sort((a, b) => a.termId.localeCompare(b.termId));
  };
  const listSessions = async ({ limit }: { limit?: number } = {}) => {
    const db = await open();
    const result: GameSession[] = [];
    let cursor = await db.transaction("sessions").store.index("startedAt").openCursor(null, "prev");
    while (cursor && (limit === undefined || result.length < limit)) {
      result.push(cursor.value);
      cursor = await cursor.continue();
    }
    return result;
  };

  return {
    async saveSession(session) {
      await (await open()).put("sessions", session);
    },
    listSessions,
    getProgress,
    async putProgress(progress) {
      await (await open()).put("progress", progress, PROGRESS_KEY);
    },
    getSettings,
    async putSettings(settings) {
      await (await open()).put("settings", settings, SETTINGS_KEY);
    },
    async getQuestionStats() {
      return (await open()).getAll("questionStats");
    },
    async getQuestionStat(questionId) {
      return (await open()).get("questionStats", questionId);
    },
    async bulkPutQuestionStats(stats) {
      const tx = (await open()).transaction("questionStats", "readwrite");
      await Promise.all([...stats.map((s) => tx.store.put(s)), tx.done]);
    },
    async getMission(dateKey) {
      return (await open()).get("dailyMissions", dateKey);
    },
    async putMission(mission) {
      await (await open()).put("dailyMissions", mission);
    },
    listTermProgress,
    async putTermProgress(records) {
      const tx = (await open()).transaction("termProgress", "readwrite");
      const clear = tx.store.clear();
      await Promise.all([clear, ...records.map((row) => tx.store.put({ ...row })), tx.done]);
    },
    async exportData(now = () => new Date()) {
      const db = await open();
      return {
        version: EXPORT_VERSION,
        exportedAt: now().toISOString(),
        progress: await getProgress(),
        sessions: await listSessions(),
        questionStats: await db.getAll("questionStats"),
        settings: await getSettings(),
        termProgress: await listTermProgress(),
      };
    },
    async importData(json) {
      const result = validateExportData(json);
      if (!result.ok) throw new ImportError(result.error);
      const { data } = result;
      const tx = (await open()).transaction(STORES, "readwrite");
      await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
      await Promise.all([
        ...data.sessions.map((s) => tx.objectStore("sessions").put(s)),
        tx.objectStore("progress").put(data.progress, PROGRESS_KEY),
        tx.objectStore("settings").put(data.settings, SETTINGS_KEY),
        ...data.questionStats.map((s) => tx.objectStore("questionStats").put(s)),
        ...data.termProgress.map((row) => tx.objectStore("termProgress").put(row)),
        tx.done,
      ]);
    },
    async clearAll() {
      const tx = (await open()).transaction(STORES, "readwrite");
      await Promise.all([...STORES.map((s) => tx.objectStore(s).clear()), tx.done]);
    },
    close() {
      void dbPromise?.then((db) => db.close());
      dbPromise = null;
    },
  };
}
