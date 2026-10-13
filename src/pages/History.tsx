import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ROUTES } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { formatDateTime, formatDuration, summarizeSessions } from "../game/stats";
import { db, type TyporiaDatabase } from "../storage";
import { DIFFICULTIES, type Difficulty, type GameSession } from "../types/game";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

export interface HistoryProps {
  /** テスト用に差し替え可能。既定は共有 DB */
  database?: Pick<TyporiaDatabase, "listSessions">;
  /** テスト用。既定は現在時刻 */
  now?: () => Date;
}

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** 学習履歴画面（docs/spec.md §4.4） */
export function History({ database = db, now = () => new Date() }: HistoryProps) {
  const { progress } = useAppContext();
  const [sessions, setSessions] = useState<GameSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    database
      .listSessions()
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [database]);

  const summary = summarizeSessions(sessions ?? [], progress, now());
  const isEmpty = sessions !== null && sessions.length === 0 && progress.totalSessions === 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-wide">History</h1>
        <Link to={ROUTES.home} className="text-subtext underline-offset-4 hover:underline">
          ホームへ戻る
        </Link>
      </header>

      {isEmpty && <p className="text-subtext">まだ記録がありません。</p>}

      <section aria-labelledby="summary-heading" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <h2 id="summary-heading" className="sr-only">
          サマリー
        </h2>
        <Stat id="total-sessions" label="総プレイ回数" value={`${summary.totalSessions} 回`} />
        <Stat label="総学習時間" value={formatDuration(summary.totalPlayTimeMs)} />
        <Stat label="累計 XP" value={`${summary.totalXP} XP`} />
        <Stat label="自己ベスト" value={String(summary.bestScore)} />
        <Stat label="現在の Streak" value={`${summary.currentStreak} 日`} />
        <Stat label="最長 Streak" value={`${summary.longestStreak} 日`} />
      </section>

      <section aria-labelledby="week-heading">
        <h2 id="week-heading" className="mb-3 text-lg font-bold">
          過去 7 日間
        </h2>
        <ul className="grid grid-cols-7 gap-2" data-testid="last-7-days">
          {summary.last7Days.map((day) => (
            <li
              key={day.dateKey}
              data-date={day.dateKey}
              data-played={day.count > 0}
              className={`flex flex-col items-center rounded-lg border px-1 py-2 text-xs ${
                day.count > 0
                  ? "border-correct bg-correct/20 text-text"
                  : "border-subtext/30 text-subtext"
              }`}
            >
              <span>{day.dateKey.slice(5).replace("-", "/")}</span>
              <span className="text-base font-bold">{day.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="accuracy-heading">
        <h2 id="accuracy-heading" className="mb-3 text-lg font-bold">
          難易度別の正答率
        </h2>
        <ul className="grid grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => {
            const a = summary.accuracyByDifficulty[d];
            return (
              <li key={d} className="rounded-lg border border-subtext/30 p-3">
                <div className="text-subtext">{DIFFICULTY_LABEL[d]}</div>
                <div className="text-2xl font-bold" data-testid={`accuracy-${d}`}>
                  {a.sessions === 0 ? "-" : `${Math.round(a.accuracy * 100)}%`}
                </div>
                <div className="text-xs text-subtext">{a.sessions} 回</div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-3 text-lg font-bold">
          最近のプレイ履歴
        </h2>
        {summary.recent.length === 0 ? (
          <p className="text-subtext">まだプレイ履歴がありません。</p>
        ) : (
          <ol className="divide-y divide-subtext/20">
            {summary.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-subtext">{formatDateTime(r.startedAt)}</span>
                <span>{DIFFICULTY_LABEL[r.difficulty]}</span>
                <span className="font-bold tabular-nums">{r.score}</span>
                <span className="text-perfect" aria-label={`星 ${r.stars}`}>
                  {stars(r.stars)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Stat({ id, label, value }: { id?: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-subtext/30 p-3">
      <div className="text-xs text-subtext">{label}</div>
      <div className="text-xl font-bold tabular-nums" data-testid={id ? `stat-${id}` : undefined}>
        {value}
      </div>
    </div>
  );
}
