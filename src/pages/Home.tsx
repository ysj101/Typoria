import { Link } from "react-router";
import { useAppNavigate, ROUTES } from "../app/navigation";

/** ホーム画面（docs/spec.md §4.1）。本体は #19 で実装 */
export function Home() {
  const nav = useAppNavigate();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-5xl font-bold tracking-widest">Typoria</h1>
      <p className="text-subtext">タイピングで英語を学ぶ、90 秒のゲーム。</p>
      <button
        type="button"
        autoFocus
        onClick={nav.toGame}
        className="rounded-full bg-perfect px-10 py-3 text-xl font-bold text-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
      >
        PLAY
      </button>
      <nav className="flex gap-6 text-subtext">
        <Link to={ROUTES.history}>学習履歴</Link>
        <Link to={ROUTES.settings}>設定</Link>
      </nav>
    </main>
  );
}
