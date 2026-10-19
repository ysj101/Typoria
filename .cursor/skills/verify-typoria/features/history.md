# History

History shows past rounds. A new profile has none.

## Sub-features

- `history-open` shows the History heading.
- `history-empty` shows `まだ記録がありません。` when the profile has no rounds.

## How to get to it (user POV)

- On home, press the `学習履歴` link.

## Driving it with typoria-verify

Preconditions:

- Doctor on `http://127.0.0.1:5173/` exited 0.
- Session file `/tmp/typoria-verify/history/session.json` does not exist.
- The session is new, so no round has been saved in it.

- **Open home.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-start --url http://127.0.0.1:5173/ --session /tmp/typoria-verify/history/session.json`.
- **Open history.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/history/session.json --role link --name "学習履歴"`.
- **See the heading.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/history/session.json --role heading --name History`.
- **See the empty state.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-text --session /tmp/typoria-verify/history/session.json --text "まだ記録がありません。"`.
- **Save the page.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/history/session.json --path /tmp/typoria-verify-evidence/history/empty.png`.
- **Stop.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/history/session.json`.

## Gotchas

- The heading text is `History`, not `学習履歴`.
- After a finished round in the same profile, the empty sentence is gone. Do not expect it then.
- Opening history does not create a round.
