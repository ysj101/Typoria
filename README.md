# Typoria

[![CI](https://github.com/ysj101/Typoria/actions/workflows/ci.yml/badge.svg)](https://github.com/ysj101/Typoria/actions/workflows/ci.yml)
[![Deploy](https://github.com/ysj101/Typoria/actions/workflows/deploy.yml/badge.svg)](https://github.com/ysj101/Typoria/actions/workflows/deploy.yml)

新人エンジニアがスマートフォンで数分、IT の基礎用語を読んで、打って、クイズで覚える学習アプリ。

対応ブラウザは macOS Chrome（現行安定版）と iPhone Chrome（iOS 現行版）です。Windows / Android / iPad / Safari / Edge での動作確認は行っていません。

## 起動方法

```bash
pnpm install
pnpm dev
```

### コミットと PR のメールアドレス保護

公開リポジトリに個人のメールアドレスを残さないため、コミットの author / committer のメール欄、コミットメッセージ全文、PR の題名と本文に **許可リスト以外のアドレスが入っていたら失敗** します。ファイルの中身は調べません。判定は末尾一致で、既定の許可リストは `@users.noreply.github.com`・`noreply@github.com`・`noreply@anthropic.com` です（`EMAIL_ALLOWLIST` 環境変数で差し替え可）。一致したアドレスは `@` より前を伏せて表示します。

- **ローカル**: `pnpm install` の `prepare` が `core.hooksPath` を `.githooks` にし、`commit-msg` フックが作成前のコミットを止めます。黙って書き換えることはしません。
- **CI**: 既存の CI ワークフローの `lint` ジョブ（main の必須チェック）の最初のステップとして同じ検査を実行します。失敗するとマージできません。squash merge のメッセージも main への push 時に検査します。

```sh
scripts/check-email-privacy.sh                    # origin/main..HEAD
scripts/check-email-privacy.sh BASE_SHA..HEAD_SHA # 任意の範囲
PR_TITLE='変更の題名' PR_BODY='変更の説明' scripts/check-email-privacy.sh
```

このフックはこのリポジトリだけを守ります。全リポジトリをまとめて守るには、GitHub の Settings → Emails で「Keep my email addresses private」と「Block command line pushes that expose my email」を有効にし、Git に `git config --global user.useConfigOnly true` を設定してください。

## スクリプト

| コマンド            | 内容                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`          | 開発サーバー起動                                                          |
| `pnpm build`        | 型チェック + 本番ビルド                                                   |
| `pnpm preview`      | ビルド成果物のプレビュー                                                  |
| `pnpm lint`         | ESLint + Prettier チェック                                                |
| `pnpm test`         | 単体テスト（Vitest）                                                      |
| `pnpm test:e2e`     | E2E テスト（Playwright、chromium + mobile-chrome）                        |
| `pnpm test:e2e:all` | E2E テスト（上記 + webkit。`pnpm exec playwright install webkit` が必要） |

初回の E2E 実行前に `pnpm exec playwright install chromium` が必要です。

## アクセシビリティ確認

`pnpm test:e2e e2e/a11y.spec.ts` で、各画面の axe（重大な違反ゼロ）、モバイル幅での横スクロールなし、キーボード操作（フォーカストラップ・Tab 順序）を確認できます。

## オフライン対応

PWA（Service Worker）により、初回読み込み後はオフラインでもプレイできます。
アイコンは `node scripts/generate-icons.mjs` で再生成できます。

## GitHub Pages

公開 URL は [https://ysj101.github.io/Typoria/](https://ysj101.github.io/Typoria/) です。リポジトリ名のサブパスで配信します。ビルド時の環境変数 `VITE_BASE_PATH` で Vite の `base` を切り替えます（未指定は `/`）。PWA manifest の `start_url` / `scope` と Service Worker の `navigateFallback` も同じパスになります。画面遷移は hash ルーターなので、サブパス用の 404 フォールバックは不要です。

```bash
VITE_BASE_PATH=/Typoria/ pnpm build
VITE_BASE_PATH=/Typoria/ pnpm preview
```

プレビューは `http://localhost:4173/Typoria/` で開けます。ローカルの `pnpm dev`、`pnpm build`、`pnpm test`、`pnpm test:e2e` は `VITE_BASE_PATH` 未設定のため `/` で動きます。CI の build ジョブは `VITE_BASE_PATH=/Typoria/` でビルドし、PR の時点でサブパス向けビルドが壊れていないか確認します。

### デプロイ

初回のみ、Pages のソースを GitHub Actions にし、Website に公開 URL を設定します。

```bash
gh api -X POST repos/ysj101/Typoria/pages -f build_type=workflow
gh repo edit ysj101/Typoria --homepage https://ysj101.github.io/Typoria/
```

`main` への push、または Actions からの手動実行（`workflow_dispatch`）で `.github/workflows/deploy.yml` が動きます。

1. `pnpm install --frozen-lockfile` で依存関係を入れる
2. `VITE_BASE_PATH=/Typoria/ pnpm build` で `dist` を作る
3. `dist` を GitHub Pages へデプロイする

進行中のデプロイはキャンセルしません。Service Worker は `registerType: "autoUpdate"` なので、公開後にページを開くと新しい Worker が有効になり、古い precache は置き換わります。

ブラウザ横断・性能の確認記録は `docs/verification.md` を参照してください（`pnpm test:e2e e2e/perf.spec.ts` で計測）。
