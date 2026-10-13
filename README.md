# Typoria

[![CI](https://github.com/ysj101/Typoria/actions/workflows/ci.yml/badge.svg)](https://github.com/ysj101/Typoria/actions/workflows/ci.yml)

タイピングで英語を学ぶ 90 秒のブラウザゲーム。

## 起動方法

```bash
npm install
npm run dev
```

## スクリプト

| コマンド           | 内容                       |
| ------------------ | -------------------------- |
| `npm run dev`      | 開発サーバー起動           |
| `npm run build`    | 型チェック + 本番ビルド    |
| `npm run preview`  | ビルド成果物のプレビュー   |
| `npm run lint`     | ESLint + Prettier チェック |
| `npm run test`     | 単体テスト（Vitest）       |
| `npm run test:e2e` | E2E テスト（Playwright）   |

初回の E2E 実行前に `npx playwright install chromium` が必要です。

## オフライン対応

PWA（Service Worker）により、初回読み込み後はオフラインでもプレイできます。
アイコンは `node scripts/generate-icons.mjs` で再生成できます。
