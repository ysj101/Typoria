import { Link } from "react-router";
import { useAppNavigate, ROUTES } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { TERMS } from "../data/terms";
import { categoryStudyCounts } from "../game/termProgress";
import { useTermProgress } from "../hooks/useTermProgress";
import { TERM_CATEGORIES, TERM_CATEGORY_LABELS } from "../types/term";

/** カテゴリ選択・用語帳で使う、1 行 1 ボタンの共通スタイル */
export const TERM_ROW_BUTTON_CLASS =
  "flex min-h-11 w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-subtext/40 px-4 py-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-fever";

/** カテゴリ選択。習得数を出して、そのカテゴリのラウンドかおまかせを始める */
export function CategorySelect() {
  const { storage } = useAppContext();
  const nav = useAppNavigate();
  const progress = useTermProgress(storage);
  const counts = categoryStudyCounts(TERMS, progress);

  return (
    <main className="screen-scroll mx-auto w-full max-w-xl gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">IT基礎用語</h1>
        <Link
          to={ROUTES.home}
          className="inline-flex min-h-11 items-center text-subtext underline-offset-4 hover:underline"
        >
          ホームへ戻る
        </Link>
      </header>
      <p className="text-subtext">カテゴリを選ぶと、その用語だけが出題されます。</p>
      <button
        type="button"
        autoFocus
        data-testid="learn-omakase"
        onClick={() => nav.toLearnRound({ mode: "omakase" })}
        className="min-h-11 w-full rounded-full bg-perfect px-6 py-3 text-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
      >
        <span className="block text-xl font-bold">おまかせ</span>
        <span className="block text-sm font-normal">未学習・学習中を優先</span>
      </button>
      <ul aria-label="カテゴリ" data-testid="category-list" className="flex flex-col gap-3">
        {TERM_CATEGORIES.map((category) => {
          const { mastered, total } = counts[category];
          const label = TERM_CATEGORY_LABELS[category];
          return (
            <li key={category} className="min-w-0">
              <button
                type="button"
                data-testid={`category-${category}`}
                data-mastered={mastered}
                data-total={total}
                onClick={() => nav.toLearnRound({ mode: "category", category })}
                className={TERM_ROW_BUTTON_CLASS}
              >
                <span className="font-bold">{label}</span>
                <span className="text-sm text-subtext tabular-nums">
                  習得 {mastered} / 全 {total} 語
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        to={ROUTES.glossary}
        className="inline-flex min-h-11 items-center font-bold text-perfect underline-offset-4 hover:underline"
      >
        用語帳
      </Link>
    </main>
  );
}
