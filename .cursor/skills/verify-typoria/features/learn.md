# Learn terms

Learn opens a category list, starts a round, and links to the glossary.

## Sub-features

- `learn-open` opens the category screen from home.
- `learn-omakase` starts a round from おまかせ.
- `learn-glossary` opens 用語帳 from the category screen.

## How to get to it (user POV)

- On home, press `IT用語を学ぶ`.
- Press `おまかせ`, or press a category row.
- Press `用語帳`.

## Driving it with typoria-verify

Preconditions:

- Doctor on `http://127.0.0.1:5173/` exited 0.
- Session file `/tmp/typoria-verify/learn/session.json` does not exist.

- **Open home.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-start --url http://127.0.0.1:5173/ --session /tmp/typoria-verify/learn/session.json`.
- **Open learn.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/learn/session.json --role button --name "IT用語を学ぶ"`.
- **See categories.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/learn/session.json --role heading --name "IT基礎用語"`. The heading is visible.
- **Save the list.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/learn/session.json --path /tmp/typoria-verify-evidence/learn/categories.png`.
- **Start おまかせ.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/learn/session.json --role button --name "おまかせ"`.
- **See the round.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-attr --session /tmp/typoria-verify/learn/session.json --testid learn --attr data-phase`. `value` is not `loading`.
- **Save the round.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/learn/session.json --path /tmp/typoria-verify-evidence/learn/round.png`.
- **Stop.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/learn/session.json`.

Glossary, from a new session, after the category heading is visible:

- **Open the glossary.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/learn/session.json --role link --name "用語帳"`.
- **See the glossary.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/learn/session.json --role heading --name "用語帳"`.

## Gotchas

- Opening `#/learn/round` directly starts おまかせ and skips the category screen. That does not prove `learn-open`.
- The おまかせ button name includes the line `未学習・学習中を優先`. Match on `おまかせ`.
- A fresh profile has no saved resume. A profile that already started a round may restore it. Use a new session.
