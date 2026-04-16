# Tampermonkey TypeScript Starter

A minimal starter project for authoring Tampermonkey userscripts in TypeScript, bundling shared utility modules into each script, and outputting minimized standalone `.user.js` files.

## What this project does

- Writes shared code in `src/utils/*.ts`
- Writes one userscript per `src/scripts/*.user.ts`
- Bundles only the imports used by each userscript
- Preserves the Tampermonkey metadata block at the top of the output file
- Emits minified standalone scripts to `dist/*.user.js`

## Project structure

```text
src/
  utils/
    dom.ts
    log.ts
    styles.ts
  scripts/
    example-banner.user.ts
    example-highlight-links.user.ts
build.mjs
package.json
tsconfig.json
```

## Getting started

```bash
npm install
npm run build
```

This creates:

```text
dist/
  example-banner.user.js
  example-highlight-links.user.js
```

## Watch mode

```bash
npm run build:watch
```

## Creating a new userscript

1. Add a new file in `src/scripts` ending with `.user.ts`
2. Put a valid Tampermonkey metadata block at the top
3. Import any shared utilities from `src/utils`
4. Run `npm run build`

Example:

```ts
// ==UserScript==
// @name         My Script
// @namespace    https://example.com/
// @version      0.1.0
// @description  My new script
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

import { log } from "../utils/log";

log("my-script", "Hello from Tampermonkey");
```

## Notes

- Every userscript entry file must contain its own metadata block.
- The output is bundled as a single file, which is usually the easiest format for Tampermonkey.
- If a utility is not imported by a script, it will not be included in that script's bundle.
- The sample build targets modern browsers with `ES2020`.

## Optional future upgrades

You could later add:

- ESLint
- Prettier
- unit tests for utility modules
- automatic version stamping
- copying output into a local Tampermonkey sync folder
- support for `@require` or GM_* APIs with typed wrappers
