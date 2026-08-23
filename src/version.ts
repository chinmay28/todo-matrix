/**
 * The running build's version, vYEAR.MONTH.<commit count> — stamped into the
 * bundle by Vite (`define` in vite.config.ts, from scripts/version.mjs); the
 * browser has no git to ask. An unstamped build reports patch 0.
 *
 * Don't assert the literal string in a test — it changes with every commit.
 */
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'v0.0.0';
