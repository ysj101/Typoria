import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAppNavigate, ROUTES } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { resolveDifficulty } from "../game/difficulty";
import { getSharedAudioEngine } from "../hooks/useAudio";
import { DAILY_MISSIONS, localDateKey, resolveMissionForDate } from "../game/habit";
import type { DailyMissionProgress, Difficulty } from "../types/game";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

/** ホームで示す学習ループ（読む → 打つ → クイズ） */
const LEARNING_STEPS = ["読む", "打つ", "クイズ"] as const;

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
  // PLAY の click に加え、touchstart / touchend でも unlock する（iOS Chrome §9.2）
  const unlockAudio = () => {
    void getSharedAudioEngine().unlock();
  };
  const onPlay = () => {
    unlockAudio();
    nav.toGame();
  };

  return (
    <main className="screen-scroll screen-center mx-auto w-full max-w-xl items-center gap-4 px-4 py-4 sm:gap-8 sm:py-10">
      <header className="flex max-w-full flex-col items-center gap-1.5 text-center sm:gap-2">
        <h1 className="text-4xl font-bold leading-none tracking-widest sm:text-6xl">Typoria</h1>
        <p className="text-xs font-bold tracking-wider text-perfect">新人エンジニア向け</p>
        <p className="text-balance text-sm leading-snug text-subtext sm:text-base">
          1 回 3 分。IT の基礎用語を読んで、打って、覚える。
        </p>
        <ol aria-label="学習の流れ" className="flex items-center text-sm font-bold">
          {LEARNING_STEPS.map((step, index) => (
            <li key={step} className="flex items-center">
              {index > 0 && (
                <span aria-hidden="true" className="px-2 font-normal text-subtext">
                  →
                </span>
              )}
              {step}
            </li>
          ))}
        </ol>
      </header>

      <button
        type="button"
        autoFocus
        onClick={onPlay}
        onTouchStart={unlockAudio}
        onTouchEnd={unlockAudio}
        className="rounded-full bg-perfect px-10 py-3 text-xl font-bold text-bg shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-fever sm:px-12 sm:py-4 sm:text-2xl"
      >
        PLAY
      </button>

      <dl
        aria-label="学習状況"
        className="grid w-full grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-bg-gradient/40 p-3 text-sm sm:grid-cols-3 sm:gap-x-6 sm:gap-y-3 sm:p-5"
      >
        <Stat label="難易度" value={DIFFICULTY_LABEL[difficulty]} testId="home-difficulty" />
        <Stat label="今日" value={playedToday ? "プレイ済み" : "未プレイ"} testId="home-today" />
        <Stat label="Streak" value={`${progress.currentStreak} 日`} testId="home-streak" />
        <Stat label="累計 XP" value={`${progress.totalXP} XP`} testId="home-xp" />
        <Stat label="自己ベスト" value={String(progress.bestScore)} testId="home-best" />
      </dl>

      <section aria-labelledby="missions-heading" className="w-full">
        <h2
          id="missions-heading"
          className="mb-1 text-xs font-bold tracking-wider text-subtext sm:mb-2 sm:text-sm"
        >
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
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 sm:py-2 ${
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
                <span className="shrink-0 tabular-nums text-subtext">
                  {current}/{def.target} · +{def.rewardXP}XP
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <nav
        aria-label="メニュー"
        className="flex flex-wrap items-center justify-center gap-2 text-subtext"
      >
        <Link
          to={ROUTES.history}
          className="px-3 underline-offset-4 hover:text-text hover:underline"
        >
          学習履歴
        </Link>
        <Link
          to={ROUTES.settings}
          className="px-3 underline-offset-4 hover:text-text hover:underline"
        >
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
      <dd data-testid={testId} className="text-base font-bold text-text sm:text-lg">
        {value}
      </dd>
    </div>
  );
}
