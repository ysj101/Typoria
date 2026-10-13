import { useEffect, useMemo, useState } from "react";
import { DAILY_MISSIONS } from "../game/habit";
import { calcStars, problemAccuracy } from "../game/scoring";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { DailyMissionId, Difficulty, GameSession } from "../types/game";

/**
 * リザルト画面の表示（docs/spec.md §4.3, §9.1、AC-09, AC-18）。
 * データは props で受け取り、演出はタイマーで進める（全演出 2 秒以内）。
 */
export interface ResultViewProps {
  session: GameSession;
  isNewRecord: boolean;
  missionRewards: { id: DailyMissionId; rewardXP: number }[];
  nextDifficulty?: Difficulty;
  streak?: number;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

/** 演出のタイムライン（ms）。合計 2 秒以内（§4.3） */
export const RESULT_TIMELINE = {
  starInterval: 150,
  scoreDuration: 800,
  tick: 16,
  newRecordAt: 800,
  xpStart: 1000,
  xpDuration: 700,
  total: 1800,
} as const;

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

interface Phase {
  starsShown: number;
  scoreShown: number;
  newRecordShown: boolean;
  xpShown: number;
  done: boolean;
}

function finalPhase(stars: number, score: number, xp: number): Phase {
  return { starsShown: stars, scoreShown: score, newRecordShown: true, xpShown: xp, done: true };
}

export function ResultView({
  session,
  isNewRecord,
  missionRewards,
  nextDifficulty,
  streak,
  onPlayAgain,
  onBackHome,
}: ResultViewProps) {
  const reduced = useReducedMotion();
  const stars = calcStars({
    solved: session.solved ?? 0,
    skipped: session.skipped ?? 0,
    correctKeystrokes: session.correctKeystrokes ?? 0,
    incorrectKeystrokes: session.incorrectKeystrokes ?? 0,
  });
  const score = session.score ?? 0;
  const sessionXp = session.xpEarned ?? 0;
  const missionXp = missionRewards.reduce((sum, m) => sum + m.rewardXP, 0);
  const totalXp = sessionXp + missionXp;
  const accuracy = Math.round(
    problemAccuracy({ solved: session.solved ?? 0, skipped: session.skipped ?? 0 }) * 100,
  );

  const [animated, setPhase] = useState<Phase>({
    starsShown: 0,
    scoreShown: 0,
    newRecordShown: false,
    xpShown: 0,
    done: false,
  });
  // reduced-motion では演出を行わず、常に最終値を表示する
  const phase = reduced ? finalPhase(stars, score, totalXp) : animated;

  // 演出（§9.1）。unmount でタイマーを全て解除する
  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    const T = RESULT_TIMELINE;

    for (let i = 1; i <= stars; i += 1) {
      timers.push(setTimeout(() => setPhase((p) => ({ ...p, starsShown: i })), T.starInterval * i));
    }

    let scoreTicks = 0;
    const scoreTotalTicks = Math.ceil(T.scoreDuration / T.tick);
    const scoreInterval = setInterval(() => {
      scoreTicks += 1;
      const t = Math.min(1, scoreTicks / scoreTotalTicks);
      const eased = 1 - (1 - t) * (1 - t);
      setPhase((p) => ({ ...p, scoreShown: Math.round(score * eased) }));
      if (t >= 1) clearInterval(scoreInterval);
    }, T.tick);
    intervals.push(scoreInterval);

    timers.push(setTimeout(() => setPhase((p) => ({ ...p, newRecordShown: true })), T.newRecordAt));

    timers.push(
      setTimeout(() => {
        let xpTicks = 0;
        const xpTotalTicks = Math.ceil(T.xpDuration / T.tick);
        const xpInterval = setInterval(() => {
          xpTicks += 1;
          const t = Math.min(1, xpTicks / xpTotalTicks);
          setPhase((p) => ({ ...p, xpShown: Math.round(totalXp * t) }));
          if (t >= 1) clearInterval(xpInterval);
        }, T.tick);
        intervals.push(xpInterval);
      }, T.xpStart),
    );

    timers.push(setTimeout(() => setPhase(finalPhase(stars, score, totalXp)), T.total));

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [reduced, stars, score, totalXp]);

  // Enter で PLAY AGAIN（演出中でも有効。AC-18）、Esc で BACK TO HOME
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onPlayAgain();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onBackHome();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPlayAgain, onBackHome]);

  const missionRows = useMemo(
    () =>
      missionRewards.map((m) => ({
        id: m.id,
        title: DAILY_MISSIONS.find((d) => d.id === m.id)?.title ?? m.id,
        rewardXP: m.rewardXP,
      })),
    [missionRewards],
  );

  const transition = reduced ? "" : "transition-all duration-300";

  return (
    <main
      className="screen-scroll screen-center items-center gap-6 p-6 text-text"
      data-testid="result-view"
      data-animation-done={phase.done ? "true" : "false"}
    >
      <h1 className="text-2xl font-bold tracking-[0.3em] text-subtext">RESULT</h1>

      <div
        className="flex gap-2 text-4xl"
        role="img"
        aria-label={`${stars} stars`}
        data-testid="stars"
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const lit = i <= phase.starsShown;
          return (
            <span
              key={i}
              data-testid="star"
              data-lit={lit ? "true" : "false"}
              className={`${transition} ${lit ? "scale-110 text-perfect" : "scale-90 text-subtext/30"}`}
              aria-hidden="true"
            >
              ★
            </span>
          );
        })}
      </div>

      <div className="text-center">
        <div className="text-sm tracking-widest text-subtext">SCORE</div>
        <div
          className="max-w-full font-bold tabular-nums text-[clamp(2.25rem,10vw,3.75rem)]"
          data-testid="score-display"
        >
          {phase.scoreShown.toLocaleString()}
        </div>
        {isNewRecord && phase.newRecordShown && (
          <div
            className={`mt-2 text-xl font-bold text-fever ${reduced ? "" : "animate-pulse"}`}
            data-testid="new-record"
          >
            NEW RECORD!
          </div>
        )}
      </div>

      <dl className="grid w-full max-w-full grid-cols-2 gap-x-6 gap-y-3 text-center sm:grid-cols-4 sm:gap-x-10">
        <div>
          <dt className="text-xs tracking-widest text-subtext">ACCURACY</dt>
          <dd className="text-2xl font-bold tabular-nums" data-testid="accuracy">
            {accuracy}%
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-widest text-subtext">BEST COMBO</dt>
          <dd className="text-2xl font-bold tabular-nums" data-testid="best-combo">
            {session.maxCombo ?? 0}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-widest text-subtext">SOLVED</dt>
          <dd className="text-2xl font-bold tabular-nums" data-testid="solved">
            {session.solved ?? 0}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-widest text-subtext">XP EARNED</dt>
          <dd className="text-2xl font-bold tabular-nums text-correct" data-testid="xp-earned">
            +{phase.xpShown}
          </dd>
        </div>
      </dl>

      {missionRows.length > 0 && (
        <ul className="w-full max-w-sm space-y-1 text-sm" data-testid="mission-rewards">
          <li className="text-xs tracking-widest text-subtext">XP 内訳</li>
          <li className="flex justify-between">
            <span>プレイ</span>
            <span className="tabular-nums">+{sessionXp} XP</span>
          </li>
          {missionRows.map((m) => (
            <li key={m.id} className="flex justify-between gap-2 text-perfect">
              <span className="min-w-0 break-words">ミッション達成: {m.title}</span>
              <span className="tabular-nums">+{m.rewardXP} XP</span>
            </li>
          ))}
        </ul>
      )}

      {(nextDifficulty || streak !== undefined) && (
        <p className="text-sm text-subtext">
          {nextDifficulty && (
            <span data-testid="next-difficulty">
              次回の難易度: {DIFFICULTY_LABEL[nextDifficulty]}
            </span>
          )}
          {nextDifficulty && streak !== undefined && " ・ "}
          {streak !== undefined && <span data-testid="streak">連続学習 {streak} 日</span>}
        </p>
      )}

      <div className="mt-2 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          autoFocus
          onClick={onPlayAgain}
          className="rounded-full bg-perfect px-8 py-3 text-lg font-bold text-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
        >
          PLAY AGAIN
        </button>
        <button
          type="button"
          onClick={onBackHome}
          className="rounded-full border border-subtext px-8 py-3 text-lg font-bold text-text focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
        >
          BACK TO HOME
        </button>
      </div>
      <p className="text-xs text-subtext">Enter: もう一度 / Esc: ホームへ</p>

      <p className="sr-only" aria-live="polite" data-testid="result-score">
        {score}
      </p>
    </main>
  );
}
