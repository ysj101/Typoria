# Play a round

PLAY starts a 90 second round. The first screen is a 3 second countdown.

## Sub-features

- `play-home` shows the Typoria heading and the PLAY button.
- `play-countdown` enters the game with `data-state` `COUNTDOWN` after PLAY.

## How to get to it (user POV)

- Open the site root.
- Press the `PLAY` button.

## Driving it with typoria-verify

Preconditions:

- Doctor on `http://127.0.0.1:5173/` exited 0.
- No session file at `/tmp/typoria-verify/play/session.json`.

- **Open home.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-start --url http://127.0.0.1:5173/ --session /tmp/typoria-verify/play/session.json`. The printed JSON has that url.
- **See the heading.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/play/session.json --role heading --name Typoria`. Stdout says `Typoria` is visible.
- **Save home.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/play/session.json --path /tmp/typoria-verify-evidence/play/home.png`. The picture shows the PLAY button.
- **Press PLAY.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/play/session.json --role button --name PLAY`.
- **See the countdown.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-attr --session /tmp/typoria-verify/play/session.json --testid game --attr data-state`. `value` is `COUNTDOWN`.
- **Save the countdown.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/play/session.json --path /tmp/typoria-verify-evidence/play/countdown.png`. The picture shows a countdown digit.
- **Stop.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/play/session.json`.

## Gotchas

- The countdown lasts about 3 seconds. Read `data-state` before it reaches `PLAYING` if the proof is the countdown.
- A screenshot of `PLAYING` is still a started round. Do not call it a countdown proof.
- Hash routes stay on the same origin. `page` URL after PLAY contains `#/game`.
