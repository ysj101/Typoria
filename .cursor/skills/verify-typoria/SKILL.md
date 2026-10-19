---
name: verify-typoria
description: "Drive Typoria in Google Chrome the way a user does. Use when checking the local app or https://ysj101.github.io/Typoria/, including PLAY, learn, settings, history, AudioContext, the service worker, the web manifest, and the favicon."
---

# Verify Typoria

Drive the web app with `.cursor/skills/verify-typoria/scripts/typoria-verify.mjs`. Run every command from the repo root after `pnpm install`. The browser is the installed Google Chrome (`channel: "chrome"`).

## Launch

Local UI (PLAY, learn, settings, history):

```bash
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs serve --port 5173 --run-dir /tmp/typoria-verify/dev
```

Ready when the command prints `{"url":"http://127.0.0.1:5173/"}`. That response includes the Typoria title and `<div id="root">`. Then run doctor. Doctor is the usable check. The PLAY button has to be visible.

`pnpm dev` does not register a service worker. For the service worker, the manifest, and the favicon link, build and preview instead:

```bash
VITE_BASE_PATH=/Typoria/ pnpm build
VITE_BASE_PATH=/Typoria/ pnpm preview --host 127.0.0.1 --port 4173 --strictPort
```

Ready when `http://127.0.0.1:4173/Typoria/` returns the app. Record the preview pid yourself and stop that pid in cleanup. `serve` only starts `pnpm dev`.

The public app is already running at `https://ysj101.github.io/Typoria/`. No local server. It serves the deployed `main` build, not an unmerged branch.

Set `HEADED=1` when a window should open on `$DISPLAY`. The default is headless.

## Doctor

```bash
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs doctor --url http://127.0.0.1:5173/
```

Exit 0 means HTTP 200, the title contains `Typoria`, and a button named `PLAY` is visible. The JSON also reports `icon` and `manifest`. A null `icon` on the public URL means the deployed HTML has no `link rel="icon"`. That is a failed favicon check, not a healthy one.

Run doctor on the URL you are about to drive. Do not drive a session whose doctor failed.

## Drive

Prefer ARIA roles and accessible names. The hash router uses `/#/learn`, `/#/settings`, `/#/history`, and `/#/glossary`.

Start a session, then send commands. The session process stays up until `session-stop`.

```bash
HEADED=1 node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-start --url http://127.0.0.1:5173/ --session /tmp/typoria-verify/dev/session.json
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-see --session /tmp/typoria-verify/dev/session.json --role heading --name Typoria
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-click --session /tmp/typoria-verify/dev/session.json --role button --name PLAY
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/dev/session.json
```

Commands: `session-click`, `session-see`, `session-text`, `session-screenshot`, `session-attr`, `session-audio`, `session-sw`, `session-manifest`, `session-favicon`. Each feature file has the full sequence.

`session-see` and `session-click` take `--role` and `--name`, or `--testid`. `session-attr` takes `--testid` and `--attr`. `session-text` takes `--text`. `session-screenshot` takes `--path`.

Public acceptance tests, when the check is the published site:

```bash
pnpm test:e2e:public
```

`scripts/e2e-public.sh` copies `e2e/` to gitignored `e2e-public/` with the `/Typoria/` prefix and runs `playwright.public.config.ts` in installed Chrome. It runs acceptance, smoke, pwa, a11y, learn, and game. It does not run `perf.spec` or the `mobile-chrome` project. Read the reporter summary. A skip is a skip. Do not count it as a pass.

A desktop run is not an iPhone run. Leave iPhone device checks unrecorded as done.

## Evidence

Write proof under `/tmp/typoria-verify-evidence/<run-id>/`. Capture the action and the next screen. For PLAY, save `home.png` before the click and `countdown.png` after it, plus the `session-attr` JSON for `data-state`. For audio, save two `session-audio` JSON reads taken at least a second apart. For the shell, save `session-sw`, `session-manifest`, and `session-favicon` JSON.

Copy proof that a pull request must show into `/opt/cursor/artifacts/pr-86/` and reference those absolute paths. Cleanup does not delete either evidence directory.

## Cleanup

Stop the session you started, then stop the dev server you started.

```bash
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs session-stop --session /tmp/typoria-verify/dev/session.json
node .cursor/skills/verify-typoria/scripts/typoria-verify.mjs cleanup --run-dir /tmp/typoria-verify/dev
```

`cleanup` reads `server.pid` in that run dir and signals that process group. It deletes the run dir. It does not delete `/tmp/typoria-verify-evidence/` or `/opt/cursor/artifacts/`. Do not kill Chrome by name.

If you started `pnpm preview` outside `serve`, kill that pid, not a preview you did not start.

## Helpers

`typoria-verify.mjs` is the harness. It is executable. Invoke it as shown above. The session wraps `AudioContext` so a later `session-audio` can list instances the app constructed. The wrap does not create an `AudioContext`. Before PLAY the list is empty.

Two runs need two ports, two run dirs, and two session files. The public URL can be opened in parallel only with separate sessions. Do not send commands to a session you did not start.

Keep the map honest with the maintain-verification-skill (`maintain-verification-skill`).
