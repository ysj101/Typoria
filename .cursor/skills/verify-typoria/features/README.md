# Typoria verification map

This directory is the source for user-facing checks. Read it before driving the app, then follow one feature file.

## Baseline preconditions

- Install dependencies with `pnpm install` from the repo root.
- For local UI, launch with `typoria-verify.mjs serve` and require doctor exit 0. See `../SKILL.md`.
- For the service worker, manifest, and favicon, use the public URL or a `VITE_BASE_PATH=/Typoria/` preview. `pnpm dev` has no service worker.
- Each session uses a new Chrome context. Do not reuse a session file.
- Do not drive a browser you did not start.

## Driving conventions

- Start from the home screen unless the feature names another URL.
- Prefer roles and accessible names over coordinates.
- Run the commands literally, including the quoted Japanese names.
- Keep proof files. Cleanup removes the run dir only.

## Proof and skip reporting

- Save the screen before the action and the screen after it.
- Record the command stdout with the screenshot path.
- A failed command stays failed. Do not switch entry points and call that a pass.
- iPhone hardware is not verified here. Do not mark it done from a desktop session.

## Features

- [Play a round](./play-game.md) covers PLAY and the countdown.
- [Learn terms](./learn.md) covers the category list, おまかせ, and the glossary link.
- [Settings](./settings.md) covers sound, effects, difficulty, and export.
- [History](./history.md) covers the empty history screen.
- [Installed app shell](./public-shell.md) covers AudioContext, the service worker, the manifest, and the favicon.
