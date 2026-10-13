/**
 * Typoria のデータモデル・状態・設定・定数の定義。
 * 仕様: docs/spec.md §12 データモデル、§13.1 状態遷移、§4.5 設定、§7.3 苦手問題、§8.2 デイリーミッション
 */

/** 難易度（§7.1） */
export type Difficulty = "easy" | "normal" | "hard";

/** 難易度の昇順リスト（§7.2 のクランプに使用） */
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"] as const;

/** 問題形式（§5.1） */
export type QuestionType = "word" | "fill_blank";

/** 問題（§12.1） */
export interface Question {
  /** `{difficulty}-{nnn}` 形式で一意 */
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  /** 日本語訳（word の場合は意味） */
  japanese: string;
  /** 英文。fill_blank は `_____` を 1 か所含む */
  english: string;
  /** 入力対象の英語 */
  answer: string;
  hint?: string;
  /** 文法項目など（例: `present-perfect`） */
  tags: string[];
}

/** 1 問の結果ステータス（§3.3 スキップ、§3.4 時間切れ） */
export type QuestionResultStatus = "solved" | "skipped" | "timeout";

/** 1 問の結果（§12.2） */
export interface QuestionResult {
  questionId: string;
  status: QuestionResultStatus;
  /** 出題から確定までの経過時間（ms）。一時停止中は含めない */
  durationMs: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  /** 誤入力 0 でクリア（§5.3） */
  perfect: boolean;
}

/** 1 プレイ分の記録（§12.2） */
export interface GameSession {
  id: string;
  /** ISO 8601 */
  startedAt: string;
  /** ISO 8601。途中終了は null（§6.6: XP は付与しない） */
  completedAt: string | null;
  difficulty: Difficulty;
  score: number;
  maxCombo: number;
  solved: number;
  skipped: number;
  perfectSolved: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  xpEarned: number;
  results: QuestionResult[];
}

/** ユーザー進捗（§12.3） */
export interface UserProgress {
  totalXP: number;
  totalSessions: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  /** `YYYY-MM-DD`（端末ローカル）。未プレイは null（§8.1） */
  lastPlayedDate: string | null;
  currentDifficulty: Difficulty;
}

/** 初回起動時の進捗（§2.1: ユーザー登録なしで開始） */
export const DEFAULT_PROGRESS: UserProgress = {
  totalXP: 0,
  totalSessions: 0,
  bestScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: null,
  currentDifficulty: "easy",
};

/** ゲーム状態（§13.1） */
export type GameState = "IDLE" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "FINISHED" | "RESULT";

/** 画面揺れの強さ（§4.5） */
export type ScreenShake = "none" | "weak" | "strong";

/** 難易度設定。`auto` は自動調整（§7.2） */
export type DifficultyMode = "auto" | Difficulty;

/** 設定（§4.5） */
export interface Settings {
  sfxEnabled: boolean;
  /** 0〜100 */
  sfxVolume: number;
  bgmEnabled: boolean;
  /** 0〜100 */
  bgmVolume: number;
  screenShake: ScreenShake;
  particles: boolean;
  difficultyMode: DifficultyMode;
}

/** 設定の初期値（§4.5） */
export const DEFAULT_SETTINGS: Settings = {
  sfxEnabled: true,
  sfxVolume: 70,
  bgmEnabled: true,
  bgmVolume: 40,
  screenShake: "weak",
  particles: true,
  difficultyMode: "auto",
};

/** 問題別統計（§7.3 の復習判定用） */
export interface QuestionStat {
  questionId: string;
  /** 出題回数（solved + skipped + timeout） */
  attempts: number;
  solved: number;
  skipped: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  /** ISO 8601 */
  lastAttemptedAt: string | null;
}

/** デイリーミッションの種類（§8.2） */
export type DailyMissionId = "play_once" | "solve_10" | "perfect_5";

/** デイリーミッション定義（§8.2） */
export interface DailyMission {
  id: DailyMissionId;
  title: string;
  /** 達成に必要な回数 */
  target: number;
  /** 報酬 XP */
  rewardXP: number;
}

/** 1 ミッション分の進捗 */
export interface DailyMissionProgressEntry {
  id: DailyMissionId;
  current: number;
  completed: boolean;
  /** 報酬付与済みフラグ（1 日 1 回のみ） */
  rewarded: boolean;
}

/** 日付ごとのミッション進捗（§8.2: 0 時で更新） */
export interface DailyMissionProgress {
  /** `YYYY-MM-DD`（端末ローカル） */
  dateKey: string;
  missions: DailyMissionProgressEntry[];
}

/** エクスポート JSON の version（§12.4） */
export const EXPORT_VERSION = 1;

/** エクスポート JSON の envelope（§12.4） */
export interface ExportData {
  version: number;
  /** ISO 8601 */
  exportedAt: string;
  progress: UserProgress;
  sessions: GameSession[];
  questionStats: QuestionStat[];
  settings: Settings;
}

// ---- ゲーム定数 -------------------------------------------------------------

/** 1 プレイの長さ（§3.1） */
export const GAME_DURATION_MS = 90_000;

/** カウントダウン（§13.2） */
export const COUNTDOWN_MS = 3_000;

/** FEVER 開始コンボ数（§6.4） */
export const FEVER_COMBO = 10;

/** PERFECT ボーナス（§6.3） */
export const PERFECT_BONUS = 30;

/** 難易度別基本スコア（§6.1） */
export const BASE_SCORE: Readonly<Record<Difficulty, number>> = {
  easy: 100,
  normal: 150,
  hard: 200,
};

/** コンボ倍率テーブル（§6.2）。`minCombo` 以上で `multiplier` を適用。降順に評価する */
export const COMBO_MULTIPLIERS: readonly { minCombo: number; multiplier: number }[] = [
  { minCombo: 20, multiplier: 2.0 },
  { minCombo: 10, multiplier: 1.5 },
  { minCombo: 5, multiplier: 1.2 },
  { minCombo: 1, multiplier: 1.0 },
];

/** 星評価の閾値（§6.5）。降順に評価する */
export const STAR_THRESHOLDS: readonly { minRate: number; stars: number }[] = [
  { minRate: 0.95, stars: 5 },
  { minRate: 0.9, stars: 4 },
  { minRate: 0.8, stars: 3 },
  { minRate: 0.7, stars: 2 },
  { minRate: 0, stars: 1 },
];

/** XP 計算（§6.6） */
export const XP_BASE = 20;
export const XP_PER_SOLVED = 5;
export const XP_PER_PERFECT = 2;

/** 出題比率 word : fill_blank（§5.1） */
export const WORD_RATIO = 0.3;

/** コンボ到達 SE を鳴らすコンボ数（§9.2） */
export const COMBO_SOUND_STEPS: readonly number[] = [5, 10, 20];
