import { Background } from "./components/Background";

export default function App() {
  return (
    <>
      <Background />
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-5xl font-bold tracking-widest">Typoria</h1>
        <p className="text-subtext">タイピングで英語を学ぶ、90 秒のゲーム。</p>
        <p className="typing-text text-2xl text-text">The quick brown fox</p>
      </main>
    </>
  );
}
