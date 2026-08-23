import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The app version, for inlining into the bundle at build time.
 *
 * Delegates to scripts/version.mjs — the single place YEAR.MONTH (source
 * constants) and PATCH (the git commit count) are assembled. Shelling out
 * rather than importing keeps TypeScript out of typing an untyped .mjs, and
 * it runs once, when Vite loads its config.
 */
export function appVersion(): string {
  const script = fileURLToPath(new URL('./scripts/version.mjs', import.meta.url));
  return execFileSync(process.execPath, [script], { encoding: 'utf8' }).trim();
}
