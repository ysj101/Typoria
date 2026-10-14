# ブラウザ横断・パフォーマンス検証（Issue #27）

docs/spec.md §14 非機能要件、§15 Phase 4 の確認記録。計測日: 2026-10-13。

## 検証方法

| 対象          | 方法                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| Chrome        | Playwright `chromium` プロジェクト（`pnpm test:e2e`。CI でも実行）                           |
| Mobile Chrome | Playwright `mobile-chrome`（Pixel 7、`hasTouch` / `isMobile`。`pnpm test:e2e`。CI でも実行） |
| Safari        | Playwright `webkit` プロジェクト（`pnpm test:e2e:all` に残す。ローカルで実行）               |
| Edge          | Chromium ベース（レンダリング・V8・Web Audio が共通）のため chromium の結果で代替            |

`pnpm test:e2e` は chromium と mobile-chrome。`pnpm test:e2e:all` はそれに webkit を加える。CI の e2e ジョブは `pnpm test:e2e`（webkit は入れない）。

## 受け入れ基準の確認表

「E2E」は `e2e/` の自動テストで確認したもの。AC-01〜AC-20 を網羅する `e2e/acceptance.spec.ts`（#26）を chromium、mobile-chrome、webkit で実行する。mobile-chrome の文字入力は `page.keyboard.type` ではなくソフトキーボード input への `insertText`（#61）。`e2e/perf.spec.ts` は desktop chromium 専用で、mobile-chrome と webkit では skip。
スマホ固有の確認は `e2e/mobile.spec.ts`（フォーカス、insertText での 1 問クリア、縦横の横スクロールなし、主要ボタン 44×44px）。
実機ブラウザでの手動確認が必要な項目は「残課題」に記載する。

| AC    | 内容                         | Chrome                          | Edge                | Safari                         | Mobile Chrome                         |
| ----- | ---------------------------- | ------------------------------- | ------------------- | ------------------------------ | ------------------------------------- |
| AC-01 | PLAY → 3 秒カウントダウン    | E2E（game.spec）                | chromium 結果で代替 | E2E（webkit）                  | E2E（mobile-chrome）                  |
| AC-02 | 90 秒で終了 → Result         | 単体（engine）+ E2E（#26）      | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-03 | 正解で進む / 誤りで進まない  | E2E（game.spec, perf.spec）     | chromium 結果で代替 | E2E（webkit）                  | E2E（mobile-chrome, insertText）      |
| AC-04 | 誤入力後に続行               | 単体（typing）+ E2E（#26）      | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-05 | 全文字入力で次の問題         | E2E（game.spec, perf.spec）     | chromium 結果で代替 | E2E（webkit）                  | E2E（mobile-chrome, insertText）      |
| AC-06 | スコア計算                   | 単体（scoring, engine）         | chromium 結果で代替 | 単体（ブラウザ非依存）         | E2E（mobile-chrome, acceptance.spec） |
| AC-07 | スキップでコンボ 0           | 単体（engine）+ E2E（#26）      | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-08 | 10 コンボで FEVER            | E2E（perf.spec）                | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-09 | Result の表示項目            | 単体（ResultView）+ axe E2E     | chromium 結果で代替 | axe E2E（webkit）              | E2E（mobile-chrome, acceptance.spec） |
| AC-10 | リロード後も記録が残る       | 単体（database）+ E2E（#26）    | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-11 | 次回難易度の変化             | 単体（difficulty, session）     | chromium 結果で代替 | 単体（ブラウザ非依存）         | E2E（mobile-chrome, acceptance.spec） |
| AC-12 | Streak                       | 単体（habit, session）          | chromium 結果で代替 | 単体（ブラウザ非依存）         | E2E（mobile-chrome, acceptance.spec） |
| AC-13 | ミッション報酬 1 日 1 回     | 単体（habit, session）          | chromium 結果で代替 | 単体（ブラウザ非依存）         | E2E（mobile-chrome, acceptance.spec） |
| AC-14 | 効果音 OFF で無音            | 単体（audio）+ E2E（#26）       | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-15 | Esc で一時停止・時間停止     | E2E（game.spec, a11y.spec）     | chromium 結果で代替 | E2E（webkit）                  | E2E（mobile-chrome, acceptance.spec） |
| AC-16 | IME 変換中に誤判定しない     | 単体（useKeyboard）+ E2E（#26） | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-17 | パーティクル OFF             | 単体（Game.test）+ E2E（#26）   | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-18 | 演出中に Enter で PLAY AGAIN | 単体（ResultView）              | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-19 | エクスポート → インポート    | 単体（database, Settings）      | chromium 結果で代替 | E2E（webkit, acceptance.spec） | E2E（mobile-chrome, acceptance.spec） |
| AC-20 | オフラインでプレイ           | E2E（pwa.spec）                 | chromium 結果で代替 | E2E（webkit）                  | E2E（mobile-chrome, pwa.spec）        |

### Mobile Chrome 固有の確認事項

`e2e/mobile.spec.ts`（Pixel 7、縦 412×839 / 横 839×412）:

- ゲーム開始（カウントダウンと PLAYING）で `soft-keyboard-input` にフォーカスが当たる
- `page.keyboard.insertText` で 1 問クリアし、コンボが 1 になる（`page.keyboard.type` は使わない）
- Home / History / Settings / Game / Result で `document.documentElement.scrollWidth <= clientWidth`
- PLAY、学習履歴、設定、一時停止、キーボードを開く、スキップ、エクスポート、効果音スイッチ、PLAY AGAIN、BACK TO HOME のタップ領域が 44×44px 以上

### Safari 固有の確認事項

- **AudioContext の unlock**: `src/game/audio.ts` の `unlock()` は PLAY ボタンの click ハンドラ（`src/pages/Home.tsx`）とゲーム領域の最初の keydown / click（`src/pages/Game.tsx`）から呼ばれ、その中で `AudioContext` を生成して `resume()` する。Safari の自動再生制限はユーザー操作内での `resume()` で解除されるため要件を満たす。実機 Safari での発音は要手動確認。
- **`keyCode === 229`（IME 変換中）**: `src/hooks/useKeyboard.ts` の `classifyKeyEvent` が `isComposing` と `keyCode === 229` の両方を無視する。単体テストで確認済み。実機の日本語 IME は要手動確認。
- **Tab キーのフォーカス移動**: Safari は既定で Tab がリンク・ボタンに止まらず Option + Tab で移動する（ブラウザ仕様）。一時停止ダイアログのフォーカストラップはブラウザ任せにせず Tab / Shift + Tab を自前で処理するよう変更し、WebKit でも「再開」⇄「やめる」を循環することを E2E で確認した。Home のリンク移動の E2E は WebKit では `Alt+Tab` で確認している。
- **webkit E2E 結果**: `acceptance.spec.ts`（AC-01〜AC-20）、`a11y.spec.ts`、`game.spec.ts`、`pwa.spec.ts`、`smoke.spec.ts` の 36 件すべて成功（`perf.spec.ts` は chromium 専用のため skip）。

## 性能計測（chromium、`e2e/perf.spec.ts`）

計測値は各テストの attachment（`input-to-paint-ms`、`question-switch-ms`、`frame-interval-ms`）に JSON で残る。

| 項目                                      | 目標（§14）     | 閾値（テスト） | 計測値                                           |
| ----------------------------------------- | --------------- | -------------- | ------------------------------------------------ |
| 入力 → 描画                               | 1 フレーム以内  | ≤ 32ms         | 最大 14.6ms（サンプル 14.6 / 13.2 / 9.0 / 11.3） |
| 問題切り替え（最終入力 → 次の問題）       | 150ms 以内      | ≤ 150ms        | 11.3ms                                           |
| FEVER 中のフレーム間隔（60 フレーム平均） | 60fps（16.7ms） | ≤ 20ms         | 平均 16.5ms（最大 18.6ms）                       |

閾値はヘッドレス環境の揺らぎを考慮した余裕値。計測は M 系 Mac のヘッドレス Chromium で、FEVER（10 コンボ）+ パーティクル + ScorePopup が動いている状態で行った。

## 最適化内容

### 演出

- `src/components/GameFx.css` のアニメーションはすべて `transform` / `opacity` のみ（レイアウトを発生させない）。
- パーティクル（`.fx-particle`）、ScorePopup、ゴースト、文字の pop / shake に `will-change: transform, opacity` を付与済み。
- パーティクルの同時表示上限は 60（`PARTICLE_LIMIT`）、ScorePopup は 5（`SCORE_POPUP_LIMIT`）。`ParticleEffect` / `ScorePopupLayer` / `GameHUD` / `TypingInput` は `React.memo`。

### フォント・precache（#5 の最終確認）

`@fontsource/noto-sans-jp` の既定 CSS は unicode-range で 124 分割されたフォント（woff + woff2）を参照しており、precache が 533 entries / 約 13.9MB になっていた。

| 変更                                                                                  | entries | サイズ     |
| ------------------------------------------------------------------------------------- | ------- | ---------- |
| 変更前                                                                                | 533     | 13,913 KiB |
| Noto Sans JP を `japanese-400.css` / `japanese-700.css`（単一ファイルのサブセット）に | —       | —          |
| precache の `globPatterns` から `woff` を除外（対応ブラウザはすべて woff2 対応）      | 25      | 2,863 KiB  |
| `includeManifestIcons: false` で manifest アイコンの重複エントリを除去                | 23      | 2,863 KiB  |

- `dist/sw.js` の precache manifest: html 1、js 2、css 1、webmanifest 1、png 4（icon-192 / icon-512 と favicon 等）、woff2 14（Inter 400 / 700 の各サブセット + Noto Sans JP japanese 400 / 700）。重複なし。
- `questions.json` は JS にバンドルされるため個別エントリは不要（JS に含まれる）。
- 音源は Web Audio API で合成しており `public/sounds` に静的ファイルは無い（`globPatterns` の `mp3,wav,ogg` は将来の追加に備えて残す）。
- `maximumFileSizeToCacheInBytes` は 5MB。最大のエントリは Noto Sans JP japanese（約 1.1MB）で範囲内。

## 残課題（要手動確認）

- 実機 Safari（macOS / iOS）での効果音・BGM の発音（AudioContext の unlock）と日本語 IME 変換中の入力（AC-14 / AC-16 は合成イベントで自動確認済み）。
- 実機 Edge での動作（Chromium ベースのため問題は想定していない）。
- CI の e2e は chromium と mobile-chrome。webkit は `pnpm test:e2e:all` をローカルで実行する。
