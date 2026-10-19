# Installed app shell

PLAY unlocks sound. The installed app has a service worker, a manifest, and an icon link. Check these on the public URL or on a `VITE_BASE_PATH=/Typoria/` preview. Do not check them on `pnpm dev`.

## Sub-features

- `shell-audio` creates a running AudioContext when the user presses PLAY, and `currentTime` advances.
- `shell-sw` reports an activated service worker whose scope is the app path.
- `shell-manifest` reports `start_url` `/Typoria/`, `scope` `/Typoria/`, `display` `standalone`, and icons 192, 512, and 512 maskable.
- `shell-favicon` reports a `link rel="icon"` whose target returns HTTP 200.

## How to get to it (user POV)

- Open `https://ysj101.github.io/Typoria/` or `http://127.0.0.1:4173/Typoria/`.
- Press PLAY for the audio check.
- The icon is the tab icon. The manifest and service worker are properties of that load.

## Driving it with typoria-verify

Preconditions:

- Doctor on the chosen URL exited 0.
- The URL is the public site or a preview built with `VITE_BASE_PATH=/Typoria/`.
- Session file `/tmp/typoria-verify/shell/session.json` does not exist.

- **Open the app.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-start --url https://ysj101.github.io/Typoria/ --session /tmp/typoria-verify/shell/session.json`.
- **Audio before PLAY.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-audio --session /tmp/typoria-verify/shell/session.json`. `contexts` is empty.
- **Save home.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-screenshot --session /tmp/typoria-verify/shell/session.json --path /tmp/typoria-verify-evidence/shell/home.png`.
- **Press PLAY.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/shell/session.json --role button --name PLAY`.
- **Wait.** Wait at least one second. The countdown screen is the user-visible result.
- **Audio after PLAY.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-audio --session /tmp/typoria-verify/shell/session.json`. One context has `state` `running`.
- **Audio advances.** Wait another second and run `session-audio` again. `currentTime` is larger than the previous read.
- **Service worker.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-sw --session /tmp/typoria-verify/shell/session.json`. `state` is `activated` and `scope` ends with `/Typoria/`.
- **Manifest.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-manifest --session /tmp/typoria-verify/shell/session.json`. `start_url` and `scope` are `/Typoria/`. Icons include `192x192`, `512x512`, and `512x512` with purpose `maskable`.
- **Favicon.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-favicon --session /tmp/typoria-verify/shell/session.json`. A pass has `link.href` pointing at `icons/icon-192.png` and `iconStatus` 200.
- **Stop.** Run `node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/shell/session.json`.

## Gotchas

- The public site serves deployed `main`. An unmerged favicon change is absent there. `link.href` null and origin `/favicon.ico` status 404 is a failed `shell-favicon` check. Do not pass it because the branch diff adds the tag.
- `pnpm dev` fails `session-sw` with `timeout`. Use preview or the public URL.
- The AudioContext probe records constructed contexts. It does not construct one. An empty list before PLAY is the expected start.
- iPhone hardware is not this check. Do not mark a phone pass from this desktop session.
