# Typoria

[![CI](https://github.com/ysj101/Typoria/actions/workflows/ci.yml/badge.svg)](https://github.com/ysj101/Typoria/actions/workflows/ci.yml)

タイピングで英語を学ぶ 90 秒のブラウザゲーム。

## 起動方法

```bash
pnpm install
pnpm dev
```

## スクリプト

| コマンド            | 内容                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`          | 開発サーバー起動                                                              |
| `pnpm build`        | 型チェック + 本番ビルド                                                       |
| `pnpm preview`      | ビルド成果物のプレビュー                                                      |
| `pnpm lint`         | ESLint + Prettier チェック                                                    |
| `pnpm test`         | 単体テスト（Vitest）                                                          |
| `pnpm test:e2e`     | E2E テスト（Playwright、chromium）                                            |
| `pnpm test:e2e:all` | E2E テスト（chromium + webkit。`pnpm exec playwright install webkit` が必要） |

初回の E2E 実行前に `pnpm exec playwright install chromium` が必要です。

## アクセシビリティ確認

`pnpm test:e2e e2e/a11y.spec.ts` で、各画面の axe（重大な違反ゼロ）、モバイル幅での横スクロールなし、キーボード操作（フォーカストラップ・Tab 順序）を確認できます。

## オフライン対応

PWA（Service Worker）により、初回読み込み後はオフラインでもプレイできます。
アイコンは `node scripts/generate-icons.mjs` で再生成できます。

## GitHub Pages

GitHub Pages は `https://ysj101.github.io/Typoria/` のようにリポジトリ名のサブパスで配信します。ビルド時の環境変数 `VITE_BASE_PATH` で Vite の `base` を切り替えます（未指定は `/`）。PWA manifest の `start_url` / `scope` と Service Worker の `navigateFallback` も同じパスになります。画面遷移は hash ルーターなので、サブパス用の 404 フォールバックは不要です。

```bash
VITE_BASE_PATH=/Typoria/ pnpm build
VITE_BASE_PATH=/Typoria/ pnpm preview
```

プレビューは `http://localhost:4173/Typoria/` で開けます。`pnpm dev`、`pnpm build`、`pnpm test`、`pnpm test:e2e` は `VITE_BASE_PATH` 未設定のため `/` で動きます。

ブラウザ横断・性能の確認記録は `docs/verification.md` を参照してください（`pnpm test:e2e e2e/perf.spec.ts` で計測）。
