import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ROUTES } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { TERMS } from "../data/terms";
import { termStudyStatus } from "../game/termProgress";
import {
  TERM_CATEGORIES,
  TERM_CATEGORY_LABELS,
  TERM_STUDY_STATUS_LABELS,
  type TermProgress,
} from "../types/term";

/** 学習した用語を読み返せる用語帳。カテゴリ別に状態を出し、タップで解説を開く */
export function Glossary() {
  const { storage } = useAppContext();
  const [progress, setProgress] = useState<TermProgress[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void storage.listTermProgress().then((rows) => {
      if (!cancelled) setProgress(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const byId = useMemo(() => new Map(progress.map((row) => [row.termId, row])), [progress]);
  const groups = TERM_CATEGORIES.map((category) => ({
    category,
    label: TERM_CATEGORY_LABELS[category],
    terms: TERMS.filter((term) => term.category === category),
  }));

  return (
    <main className="screen-scroll mx-auto w-full max-w-xl gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">用語帳</h1>
        <Link
          to={ROUTES.learn}
          className="inline-flex min-h-11 items-center text-subtext underline-offset-4 hover:underline"
        >
          カテゴリ選択へ
        </Link>
      </header>
      <p className="text-subtext">用語をタップすると解説を読み返せます。</p>
      {groups.map((group) => (
        <section
          key={group.category}
          aria-labelledby={`glossary-${group.category}`}
          className="flex min-w-0 flex-col gap-2"
        >
          <h2 id={`glossary-${group.category}`} className="text-lg font-bold">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.terms.map((term) => {
              const status = termStudyStatus(byId.get(term.id));
              const open = openId === term.id;
              const panelId = `glossary-panel-${term.id}`;
              return (
                <li key={term.id} className="min-w-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={open ? panelId : undefined}
                    data-testid="glossary-term"
                    data-term-id={term.id}
                    data-status={status}
                    onClick={() => setOpenId(open ? null : term.id)}
                    className="flex min-h-11 w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-subtext/40 px-4 py-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
                  >
                    <span className="font-bold">{term.name}</span>
                    <span className="text-sm text-subtext">{TERM_STUDY_STATUS_LABELS[status]}</span>
                  </button>
                  {open && (
                    <p
                      id={panelId}
                      data-testid="glossary-explanation"
                      className="px-4 py-3 text-sm leading-relaxed break-words text-text"
                    >
                      {term.explanation}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
