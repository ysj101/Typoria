import { useResultPayload } from "../app/navigation";

/** リザルト画面（docs/spec.md §4.3）。本体は #18 で実装 */
export function Result() {
  const payload = useResultPayload();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">Result</h1>
      {payload && <p data-testid="result-score">{payload.session.score}</p>}
    </main>
  );
}
