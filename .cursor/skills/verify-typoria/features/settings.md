# Settings

Settings changes sound, effects, difficulty, and learning-data export. Values stay in the browser profile.

## Sub-features

- `settings-open` shows the Settings heading.
- `settings-sound` shows the 効果音 switch.
- `settings-export` shows `JSON をエクスポート`.

## How to get to it (user POV)

- On home, press the `設定` link.

## Driving it with typoria-verify

Preconditions:

- Doctor on `http://127.0.0.1:5173/` exited 0.
- Session file `/tmp/typoria-verify/settings/session.json` does not exist.

- **Open home.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-start --url http://127.0.0.1:5173/ --session /tmp/typoria-verify/settings/session.json`.
- **Open settings.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/settings/session.json --role link --name "設定"`.
- **See the page.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/settings/session.json --role heading --name Settings`.
- **See the sound switch.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/settings/session.json --role switch --name "効果音"`.
- **See export.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/settings/session.json --role button --name "JSON をエクスポート"`.
- **Save the page.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/settings/session.json --path /tmp/typoria-verify-evidence/settings/settings.png`.
- **Stop.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/settings/session.json`.

## Gotchas

- The heading text is `Settings`, not `設定`.
- Toggling 効果音 writes IndexedDB. A proof that only needs the control visible should not toggle it.
- Export downloads a JSON file. Visibility of the button is not proof that a file was saved.
