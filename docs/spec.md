# Typoria 仕様書（MVP）

> 本書は GitHub Issue #1〜#28 に記載された要件から再構成したものです。各 Issue が参照する章番号に対応します。

## 1. コンセプト

タイピングで英語を学ぶ、90 秒のブラウザゲーム。中学〜高校レベルの英単語・英文法を「問題を読む → 英語を打つ」の反復で身につける。ゲームとしての気持ちよさ（コンボ・FEVER・演出・効果音）を最優先する。

## 2. 前提

### 2.1 データ

- 学習データはすべて端末内（IndexedDB）に保存する。サーバーは持たない。
- ユーザー登録は不要。初回起動時はデフォルト値で開始する。
- JSON のエクスポート／インポートで端末間のデータ移行ができる。

## 3. ゲームの基本仕様

### 3.1 1 プレイの流れ

1. ホームで PLAY → 3 秒カウントダウン（§13.1 COUNTDOWN）
2. 90 秒間、問題を次々に解く（PLAYING）
3. 時間切れで終了（FINISHED）→ リザルト画面（RESULT）

### 3.2 問題クリア

- 入力対象の英語を最後まで正しく打つと問題クリア。
- クリア時にスコア加算・コンボ +1。

### 3.3 スキップ

- `Ctrl + Enter` またはスキップボタンで現在の問題をスキップできる。
- スキップは未正解として記録し、コンボは 0 にリセット。同一セッション内で再出題しない。

### 3.4 時間切れ

- 入力途中で 90 秒に達した問題は `timeout` として記録し、正答率の分母に含めない。

### 3.5 一時停止

- `Esc` で一時停止（PAUSED）、再度 `Esc` で再開。一時停止中は残り時間が進まない。
- タブが非表示になった場合も自動で一時停止する。

## 4. 画面構成

### 4.1 ホーム画面

- ロゴ、キャッチコピー、PLAY ボタン（autoFocus。Enter / Space で開始）
- 現在の難易度、今日の学習状況、Streak、累計 XP、自己ベスト
- デイリーミッション（コンパクト表示）
- 学習履歴・設定へのリンク
- キーボードのみで 2 操作以内に Game へ遷移できる

### 4.2 ゲーム画面

- HUD: SCORE、TIME（mm:ss）、進捗バー、COMBO
- 問題表示: 日本語・英文・入力対象を中央に大きく表示。入力済 / 未入力 / 誤入力を色分け、文字間隔を広げる
- コンボに応じて背景演出を変化（normal → combo → fever）
- スキップボタン、一時停止オーバーレイ
- ゲーム中は原則マウス不要

### 4.3 リザルト画面

- 星評価（§6.5）を順番に表示、スコアのカウントアップ、NEW RECORD 演出、XP 獲得アニメーション
- 表示: Accuracy, Best Combo, Solved, XP Earned（ミッション報酬があれば内訳）
- 全演出は 2 秒以内に完了。演出中でも PLAY AGAIN を操作可能（Enter キー）
- PLAY AGAIN → Game、BACK TO HOME → Home

### 4.4 学習履歴画面

- 総プレイ回数、総学習時間、累計 XP、自己ベスト、現在 / 最長 Streak
- 過去 7 日間の学習状況（日別のプレイ有無・回数）
- 難易度別の正答率
- 最近のプレイ履歴（直近 10 件: 日時・難易度・スコア・星）

### 4.5 設定画面

| 項目         | 選択肢                          | 初期値   |
| ------------ | ------------------------------- | -------- |
| 効果音       | ON / OFF、音量 0〜100           | ON, 70   |
| BGM          | ON / OFF、音量 0〜100           | ON, 40   |
| 画面揺れ     | なし / 弱 / 強                  | 弱       |
| パーティクル | ON / OFF                        | ON       |
| 難易度       | 自動調整 / Easy / Normal / Hard | 自動調整 |

- 変更は即時保存する。
- JSON エクスポート（ダウンロード）／インポート（ファイル選択 → 検証 → 置換確認 → 実行。失敗時はエラー表示）。
- OS の `prefers-reduced-motion` が有効な場合、アニメーションを停止または軽減する。

## 5. 問題とタイピング

### 5.1 問題形式

| type         | 内容                                                      | 比率 |
| ------------ | --------------------------------------------------------- | ---- |
| `word`       | 日本語の意味を見て英単語を打つ                            | 30%  |
| `fill_blank` | 日本語訳と空欄 `_____` 入りの英文を見て、空欄の語句を打つ | 70%  |

### 5.2 入力判定

- 大文字・小文字を区別しない。
- Space は answer の該当位置に含まれる場合のみ受理する。
- 誤入力ではカーソルを進めず `incorrectKeystrokes` を加算する。その後正しい文字で続行できる。
- Backspace は無視する（確定済み文字を戻さない）。
- 英数字以外（アポストロフィ等）は answer に含まれる場合のみ受理する。
- 正しい入力: 文字の拡大・縮小（80ms）。誤入力: 文字の揺れ（120ms）+ 画面揺れ（設定）。

### 5.3 PERFECT 判定

- 1 問を誤入力 0 でクリアすると PERFECT。

### 5.4 キーボード操作

| キー           | 動作            |
| -------------- | --------------- |
| 1 文字キー     | 文字入力        |
| `Ctrl + Enter` | スキップ        |
| `Esc`          | 一時停止 / 再開 |

- IME 変換中（`event.isComposing` または `keyCode === 229`）は判定しない。
- Tab は素通し、Cmd / Ctrl + 文字などの修飾キー付きは無視する。
- ゲーム領域にフォーカスがある場合のみ有効。

## 6. スコア

### 6.1 基本スコア

| 難易度 | 基本スコア |
| ------ | ---------- |
| Easy   | 100        |
| Normal | 150        |
| Hard   | 200        |

### 6.2 コンボ倍率

コンボ数は「この問題をクリアした時点のコンボ数」（1 問目のクリアで 1）。

| コンボ | 倍率 |
| ------ | ---- |
| 1〜4   | 1.0  |
| 5〜9   | 1.2  |
| 10〜19 | 1.5  |
| 20〜   | 2.0  |

### 6.3 PERFECT ボーナス

- PERFECT で +30。
- 問題スコア = `floor(base * multiplier) + perfectBonus`
- 例: Normal・10 コンボ目・PERFECT → `floor(150 * 1.5) + 30 = 255`

### 6.4 FEVER

- コンボ 10 以上で FEVER。背景・光の変化（500ms）、BGM に追加レイヤー。
- コンボが 0 になると終了。

### 6.5 星評価

- `問題正答率 = solved / (solved + skipped)`（timeout は分母に含めない）
- `タイピング正確率 = correctKeystrokes / (correctKeystrokes + incorrectKeystrokes)`
- `総合 = 問題正答率 * 0.6 + タイピング正確率 * 0.4`（分母 0 は 0）
- solved = 0 なら星 0

| 総合     | 星  |
| -------- | --- |
| 95%〜    | 5   |
| 90%〜    | 4   |
| 80%〜    | 3   |
| 70%〜    | 2   |
| 70% 未満 | 1   |

### 6.6 XP

- `XP = 20 + solved * 5 + perfectSolved * 2`
- 途中終了（`completedAt === null`）は 0。

## 7. 学習

### 7.1 難易度構成

| 難易度 | 学習対象           |
| ------ | ------------------ |
| Easy   | 基本単語・be 動詞  |
| Normal | 時制・基本文法     |
| Hard   | 仮定法・複雑な文法 |

各 50 問、合計 150 問。

### 7.2 自動難易度調整

セッション終了時に次回難易度を決める。

- 問題正答率 90% 以上かつ平均回答時間 5 秒以内 → 1 段階上げる
- 70% 以上 → 維持
- 70% 未満 → 1 段階下げる
- 正解 0 件 → 1 段階下げる
- 平均回答時間は `solved` の `durationMs` の平均
- Easy〜Hard でクランプ。設定が固定難易度の場合はその値。

### 7.3 苦手問題の復習

次のいずれかに該当する問題を優先出題する。

- スキップ歴がある
- 誤入力が多い（1 回の挑戦あたり平均 3 回以上）
- 正答率 80% 未満

## 8. 習慣化

### 8.1 連続学習日数（Streak）

- 端末ローカルタイムゾーンの日付（`YYYY-MM-DD`）で判定。
- 同日 → 変化なし、前日にプレイ → +1、それ以外 → 1。`longestStreak` を更新。

### 8.2 デイリーミッション

| ミッション   | 報酬 |
| ------------ | ---- |
| 1 回プレイ   | 20XP |
| 10 問クリア  | 30XP |
| PERFECT 5 回 | 30XP |

- 複数プレイにまたがって集計。達成時の報酬は 1 日 1 回のみ。
- 0 時（ローカル）で更新。

## 9. 演出

### 9.1 アニメーション

| 対象                          | 時間  |
| ----------------------------- | ----- |
| 正しい入力の拡大・縮小        | 80ms  |
| 誤入力の揺れ                  | 120ms |
| 問題クリアのフェードアウト    | 150ms |
| ScorePopup（+250 / PERFECT!） | 300ms |
| ComboDisplay スケール         | 150ms |
| FEVER 開始                    | 500ms |
| 自己ベスト更新                | 800ms |
| 画面遷移                      | 400ms |

- 演出はゲーム進行をブロックしない。クリア後 150ms 以内に次の入力を受け付ける。
- パーティクルは設定 ON 時のみ。粒子数に上限を設ける。

### 9.2 サウンド

SE 7 種: `key`, `miss`, `clear`, `perfect`, `combo`（5, 10, 20 で音程上昇）, `fever`, `result`。ゲーム中 BGM、FEVER で追加レイヤー、一時停止で BGM 停止。PLAY 押下で `AudioContext` を unlock する。

## 10. デザイン

### 10.2 カラーパレット

| 名前        | 値      |
| ----------- | ------- |
| bg          | #0B1026 |
| bg-gradient | #1B2559 |
| text        | #F8FAFC |
| subtext     | #94A3B8 |
| correct     | #4ADE80 |
| incorrect   | #F87171 |
| perfect     | #FACC15 |
| fever       | #F472B6 |

### 10.3 フォント

Inter（英文）/ Noto Sans JP（日本語）。オフライン要件のため self-host。

### 10.4 UI 原則

- 入力の視認性を最優先する。
- 夜空・星・グラデーションの背景。
- キーボードのみで完結する。

## 11. 技術

### 11.1 技術スタック

Vite + React + TypeScript（strict）、Tailwind CSS、Motion、Vitest、Playwright、IndexedDB（idb）、vite-plugin-pwa。

### 11.2 ディレクトリ構成

```
src/
  components/  共通 UI
  pages/       Home / Game / Result / History / Settings
  game/        純粋なゲームロジック（React 非依存）
  hooks/       React フック
  data/        問題データ
  storage/     IndexedDB
  types/       型定義
public/
  sounds/
  assets/
```

## 12. データモデル

### 12.1 Question

```ts
type Difficulty = "easy" | "normal" | "hard";
interface Question {
  id: string; // `{difficulty}-{nnn}`
  type: "word" | "fill_blank";
  difficulty: Difficulty;
  japanese: string; // 日本語訳（word の場合は意味）
  english: string; // 英文（fill_blank は `_____` を 1 か所含む）
  answer: string; // 入力対象
  hint?: string;
  tags: string[];
}
```

### 12.2 GameSession / QuestionResult

```ts
interface QuestionResult {
  questionId: string;
  status: "solved" | "skipped" | "timeout";
  durationMs: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  perfect: boolean;
}
interface GameSession {
  id: string;
  startedAt: string; // ISO
  completedAt: string | null; // 途中終了は null
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
```

### 12.3 UserProgress

```ts
interface UserProgress {
  totalXP: number;
  totalSessions: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null; // YYYY-MM-DD
  currentDifficulty: Difficulty;
}
```

### 12.4 エクスポート JSON

`{ version, exportedAt, progress, sessions, questionStats, settings }`。インポート時は version を検証し全置換する。検証失敗時は既存データを変更しない。

## 13. ゲームエンジン

### 13.1 状態遷移

`IDLE → COUNTDOWN → PLAYING ⇄ PAUSED → FINISHED → RESULT`

### 13.2 時間管理

- 時間は注入された `now()`（`performance.now()`）基準。`requestAnimationFrame` で `tick`。
- カウントダウン 3,000ms、ゲーム 90,000ms。
- 一時停止中は時間を進めない。

### 13.3 問題選択

- 現在の難易度に該当する問題を優先。
- 同一セッション内で出題済み・スキップ済みの問題は再出題しない。
- 苦手問題（§7.3）を優先出題。
- word : fill_blank = 3 : 7 で抽選。
- 使い切ったらシャッフルして再利用。

## 14. 非機能要件

- オフライン: 初回読み込み後、主要機能をオフラインで利用できる（PWA）。学習履歴を外部サーバーに送らない。
- アクセシビリティ: キーボードのみで操作可能、WCAG AA コントラスト、`aria-live` で結果を通知、reduced-motion 対応。
- レスポンシブ: モバイル幅で横スクロールなしに閲覧可能。
- パフォーマンス: 60fps、入力 → 描画 1 フレーム以内、問題切り替え 150ms 以内。
- 対応ブラウザ: Chrome / Edge / Safari 現行安定版。

## 15. 開発フェーズ

- Phase 1 core: 型・スコア・タイピング・エンジン・画面骨格・ゲーム画面
- Phase 2 feel: デザイン・演出・サウンド
- Phase 3 learning: 問題データ・選択・難易度・ストレージ・習慣化・履歴・設定
- Phase 4 quality: CI・PWA・a11y・E2E・問題データの検証・ブラウザ横断検証

## 16. 受け入れ基準

| ID    | 内容                                                                |
| ----- | ------------------------------------------------------------------- |
| AC-01 | PLAY で 3 秒カウントダウン後にゲームが始まる                        |
| AC-02 | 90 秒経過でゲームが終了しリザルトへ遷移する                         |
| AC-03 | 正しい文字でカーソルが進み、誤った文字では進まない                  |
| AC-04 | 誤入力後に正しい文字で続行できる                                    |
| AC-05 | 全文字入力で次の問題に進む                                          |
| AC-06 | スコアが §6 の計算式どおりに加算される                              |
| AC-07 | スキップでコンボが 0 になり次の問題に進む                           |
| AC-08 | 10 コンボで FEVER 表示になる                                        |
| AC-09 | リザルトに星・スコア・Accuracy・Best Combo・Solved・XP が表示される |
| AC-10 | リロード後も記録（IndexedDB）が残る                                 |
| AC-11 | 成績に応じて次回難易度が変わる                                      |
| AC-12 | 連続日プレイで Streak が増える                                      |
| AC-13 | デイリーミッションの達成で報酬 XP が 1 日 1 回付与される            |
| AC-14 | 設定で効果音 OFF にすると無音になる                                 |
| AC-15 | Esc で一時停止し、時間が止まる                                      |
| AC-16 | IME 変換中の入力で誤判定しない                                      |
| AC-17 | 設定でパーティクル OFF にすると表示されない                         |
| AC-18 | リザルトの演出中でも Enter で PLAY AGAIN できる                     |
| AC-19 | エクスポート → インポートで同じデータが復元される                   |
| AC-20 | オフラインでもプレイできる                                          |

## 18. 設計原則

### 18.1 ロジックと UI の分離

ゲームロジックは `src/game` に React 非依存の純関数・ステートマシンとして置く。

### 18.2 入力速度を最優先

キー入力は同期的に処理し、演出や音声は入力受付を妨げない。

### 18.3 演出はブロックしない

演出中も入力・操作を受け付ける。

### 18.4 LLM をゲーム中に呼ばない

問題データは静的 JSON に固定する。
