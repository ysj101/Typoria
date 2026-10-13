import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAppNavigate, ROUTES } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { resolveDifficulty } from "../game/difficulty";
import { DAILY_MISSIONS, localDateKey, resolveMissionForDate } from "../game/habit";
import type { DailyMissionProgress, Difficulty } from "../types/game";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

/** ホーム画面（docs/spec.md §4.1, §8） */
export function Home() {
  const nav = useAppNavigate();
  const { settings, progress, storage } = useAppContext();
  const todayKey = localDateKey(new Date());
  const [mission, setMission] = useState<DailyMissionProgress>(() =>
    resolveMissionForDate(undefined, todayKey),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await storage.getMission?.(todayKey);
      if (!cancelled) setMission(resolveMissionForDate(stored, todayKey));
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, todayKey]);

  const difficulty = resolveDifficulty(settings.difficultyMode, progress);
  const playedToday = progress.lastPlayedDate === todayKey;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-5xl font-bold tracking-widest sm:text-6xl">Typoria</h1>
        <p className="text-subtext">タイピングで英語を学ぶ、90 秒のゲーム。</p>
      </header>

      <button
        type="button"
        autoFocus
        onClick={nav.toGame}
        className="rounded-full bg-perfect px-12 py-4 text-2xl font-bold text-bg shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
      >
        PLAY
      </button>

      <dl
        aria-label="学習状況"
        className="grid w-full grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-bg-gradient/40 p-5 text-sm sm:grid-cols-3"
      >
        <Stat label="難易度" value={DIFFICULTY_LABEL[difficulty]} testId="home-difficulty" />
        <Stat label="今日" value={playedToday ? "プレイ済み" : "未プレイ"} testId="home-today" />
        <Stat label="Streak" value={`${progress.currentStreak} 日`} testId="home-streak" />
        <Stat label="累計 XP" value={`${progress.totalXP} XP`} testId="home-xp" />
        <Stat label="自己ベスト" value={String(progress.bestScore)} testId="home-best" />
      </dl>

      <section aria-labelledby="missions-heading" className="w-full">
        <h2 id="missions-heading" className="mb-2 text-sm font-bold tracking-wider text-subtext">
          今日のミッション
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {DAILY_MISSIONS.map((def) => {
            const entry = mission.missions.find((m) => m.id === def.id);
            const current = Math.min(entry?.current ?? 0, def.target);
            const done = entry?.completed ?? false;
            return (
              <li
                key={def.id}
                data-testid={`mission-${def.id}`}
                data-completed={done}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  done ? "bg-correct/15 text-correct" : "bg-bg-gradient/40 text-text"
                }`}
              >
                <span>
                  <span aria-hidden="true" className="mr-2">
                    {done ? "✓" : "○"}
                  </span>
                  {def.title}
                  {done && <span className="sr-only">（達成）</span>}
                </span>
                <span className="tabular-nums text-subtext">
                  {current}/{def.target} · +{def.rewardXP}XP
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <nav aria-label="メニュー" className="flex gap-8 text-subtext">
        <Link to={ROUTES.history} className="underline-offset-4 hover:text-text hover:underline">
          学習履歴
        </Link>
        <Link to={ROUTES.settings} className="underline-offset-4 hover:text-text hover:underline">
          設定
        </Link>
      </nav>
    </main>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-subtext">{label}</dt>
      <dd data-testid={testId} className="text-lg font-bold text-text">
        {value}
      </dd>
    </div>
  );
}
