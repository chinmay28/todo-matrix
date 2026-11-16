import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, backupFileName, fromBackup, toBackup } from './backup.js';
import type { Task } from './types.js';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  quadrant: 'do',
  createdAt: '2026-11-16T09:00:00.000Z',
  completedAt: null,
  ...extra,
});

describe('backup', () => {
  it('round-trips every task, completed ones included', () => {
    const tasks = [task('a'), task('b', { quadrant: 'later', completedAt: '2026-11-16T10:00:00.000Z' })];
    const text = toBackup(tasks, new Date('2026-11-16T12:00:00Z'));
    expect(fromBackup(text)).toEqual({ ok: true, tasks, skipped: 0 });
  });

  it('names the app, the format and when it was made', () => {
    const o = JSON.parse(toBackup([], new Date('2026-11-16T12:00:00Z')));
    expect(o).toMatchObject({ app: 'todo-matrix', format: BACKUP_FORMAT, exportedAt: '2026-11-16T12:00:00.000Z', tasks: [] });
  });

  it('accepts the bare localStorage blob', () => {
    expect(fromBackup(JSON.stringify({ tasks: [task('a')] }))).toEqual({ ok: true, tasks: [task('a')], skipped: 0 });
  });

  it('skips and counts malformed rows rather than failing the file', () => {
    const text = JSON.stringify({ app: 'todo-matrix', format: 1, tasks: [task('a'), { id: 1 }, null, task('b', { quadrant: 'nope' as never })] });
    expect(fromBackup(text)).toEqual({ ok: true, tasks: [task('a')], skipped: 3 });
  });

  it('refuses what is not a backup, saying why', () => {
    for (const text of ['not json', '[]', 'null', '42', '{"tasks": "x"}', '{}']) {
      expect(fromBackup(text).ok).toBe(false);
    }
    expect(fromBackup('{"app":"other","tasks":[]}')).toMatchObject({ ok: false, error: expect.stringMatching(/another app/) });
    expect(fromBackup(`{"app":"todo-matrix","format":${BACKUP_FORMAT + 1},"tasks":[]}`)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    });
  });

  it('names the file after the local day', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('todo-matrix-2026-01-05.json');
  });
});
