#!/usr/bin/env sh
# 公開 URL（GitHub Pages のサブパス /Typoria/）に対して、インストール済みの Google Chrome 安定版で E2E を実行する（#62）。
# e2e/ の `page.goto("/...")` はオリジン直下へ解決されるため、サブパスを前置したコピーを e2e-public/ に生成して実行する。
set -eu
cd "$(dirname "$0")/.."
BASE_PATH="${PUBLIC_BASE_PATH:-/Typoria/}"
rm -rf e2e-public
cp -R e2e e2e-public
for f in e2e-public/*.ts; do
  sed -i.bak \
    -e "s#goto(\"/#goto(\"${BASE_PATH}#g" \
    -e "s#\"/\#/#\"${BASE_PATH}\#/#g" \
    -e "s#\[\"/\", #[\"${BASE_PATH}\", #g" \
    "$f"
  rm -f "$f.bak"
done
# perf.spec は localhost 前提の計測、mobile 系は mobile-chrome プロジェクト専用なので除く
pnpm exec playwright test --config playwright.public.config.ts \
  e2e-public/acceptance.spec.ts e2e-public/smoke.spec.ts e2e-public/pwa.spec.ts \
  e2e-public/a11y.spec.ts e2e-public/learn.spec.ts e2e-public/game.spec.ts "$@"
