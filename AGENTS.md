# AGENTS.md

Asteroids clone in vanilla HTML5 Canvas. No dependencies, no bundler, no build/test/lint toolchain — there is no `package.json`, so don't look for npm scripts or CI.

## Running / verification

Open `index.html` directly in a browser, or:

```bash
npx serve .   # http://localhost:3000
```

There are no tests; verification is manual (play the game).

## Structure constraints

- The entire game lives in `game.js`: one file, global scope, plain `<script src>` in `index.html`. No ES modules — add new code to `game.js` rather than creating new files.
- Canvas size is defined twice: `width`/`height` attributes in `index.html` and `W`/`H` constants in `game.js`. They must stay in sync.
- The world is toroidal; all movement must go through `wrap(v, max)`, not manual bounds checks.

## Conventions

- Everything — comments, UI strings, README — is in Spanish. Keep new code, comments, and user-facing text in Spanish.
- Sections in `game.js` are marked with `// ── Nombre ──` divider comments.
- Input: held keys read `keys['ArrowLeft']`; single-shot actions must use `pressed('Space')`, which consumes the `justPressed` edge-detection buffer. Using `keys[]` for one-fire actions causes repeat-per-frame bugs.
- New keys that scroll the page must be added to the `preventDefault()` list in the `keydown` handler.
- Game states are strings: `'playing' | 'dead' | 'gameover'` (see `update(dt)`).
