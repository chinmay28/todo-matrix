import { isTask } from './store.js';
import type { Task } from './types.js';

/**
 * A backup is the task list as a JSON file the person keeps: exported from
 * the menu, imported on another browser or phone (or the same one after its
 * site data was cleared — localStorage is the only copy otherwise).
 *
 *   { "app": "todo-matrix", "format": 1, "exportedAt": "…", "tasks": [Task…] }
 *
 * `format` is the backup's own version, independent of the app version and
 * of the localStorage key's; a later format must keep reading this one.
 * Import also accepts the bare `{ "tasks": [...] }` localStorage blob, so a
 * value copied out of the browser's dev tools restores as well.
 */
export const BACKUP_FORMAT = 1;

export function toBackup(tasks: readonly Task[], at: Date): string {
  return `${JSON.stringify(
    { app: 'todo-matrix', format: BACKUP_FORMAT, exportedAt: at.toISOString(), tasks },
    null,
    2,
  )}\n`;
}

/** todo-matrix-2026-11-16.json — the date the person made it, in their own day. */
export function backupFileName(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `todo-matrix-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}.json`;
}

export type BackupResult = { ok: true; tasks: Task[]; skipped: number } | { ok: false; error: string };

/**
 * The tasks in a backup. Strict about the envelope (a file that isn't one is
 * an error the person sees), lenient about rows: a malformed task is skipped
 * and counted, exactly as load() drops one from localStorage.
 */
export function fromBackup(text: string): BackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not a To Do Matrix backup (not JSON).' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'That file is not a To Do Matrix backup.' };
  }
  const o = parsed as Record<string, unknown>;
  if (o['app'] !== undefined && o['app'] !== 'todo-matrix') {
    return { ok: false, error: 'That file is a backup from another app.' };
  }
  if (typeof o['format'] === 'number' && o['format'] > BACKUP_FORMAT) {
    return { ok: false, error: 'That backup is from a newer version of To Do Matrix — update this one first.' };
  }
  const rows = o['tasks'];
  if (!Array.isArray(rows)) {
    return { ok: false, error: 'That file is not a To Do Matrix backup (no task list).' };
  }
  const tasks = rows.filter(isTask);
  return { ok: true, tasks, skipped: rows.length - tasks.length };
}
