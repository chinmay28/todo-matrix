import { describe, expect, it } from 'vitest';
import {
  doneTasks,
  emptyState,
  load,
  openTasks,
  reduce,
  save,
  type State,
} from './store.js';
import { quadrantFor } from './types.js';

const T0 = '2026-08-23T10:00:00.000Z';
const T1 = '2026-08-23T11:00:00.000Z';

function withTasks(...adds: Array<{ id: string; title: string; quadrant?: 'do' | 'schedule' | 'delegate' | 'later' }>): State {
  return adds.reduce<State>(
    (s, a) =>
      reduce(s, {
        type: 'add',
        id: a.id,
        title: a.title,
        quadrant: a.quadrant ?? 'do',
        at: T0,
      }),
    emptyState,
  );
}

describe('reduce', () => {
  it('adds a trimmed task and ignores blank titles', () => {
    const s = reduce(emptyState, { type: 'add', id: 'a', title: '  pay rent  ', quadrant: 'do', at: T0 });
    expect(s.tasks).toEqual([
      { id: 'a', title: 'pay rent', quadrant: 'do', createdAt: T0, completedAt: null },
    ]);
    expect(reduce(emptyState, { type: 'add', id: 'b', title: '   ', quadrant: 'do', at: T0 }).tasks).toEqual([]);
  });

  it('toggles completion both ways', () => {
    let s = withTasks({ id: 'a', title: 'x' });
    s = reduce(s, { type: 'toggle', id: 'a', at: T1 });
    expect(s.tasks[0]?.completedAt).toBe(T1);
    s = reduce(s, { type: 'toggle', id: 'a', at: T1 });
    expect(s.tasks[0]?.completedAt).toBeNull();
  });

  it('moves a task between quadrants', () => {
    let s = withTasks({ id: 'a', title: 'x', quadrant: 'do' });
    s = reduce(s, { type: 'move', id: 'a', quadrant: 'later' });
    expect(openTasks(s, 'do')).toEqual([]);
    expect(openTasks(s, 'later').map((t) => t.id)).toEqual(['a']);
  });

  it('renames with trimming and refuses an empty rename', () => {
    let s = withTasks({ id: 'a', title: 'x' });
    s = reduce(s, { type: 'rename', id: 'a', title: '  y  ' });
    expect(s.tasks[0]?.title).toBe('y');
    s = reduce(s, { type: 'rename', id: 'a', title: ' ' });
    expect(s.tasks[0]?.title).toBe('y');
  });

  it('removes a task and clears only one quadrant of done tasks', () => {
    let s = withTasks(
      { id: 'a', title: 'a', quadrant: 'do' },
      { id: 'b', title: 'b', quadrant: 'do' },
      { id: 'c', title: 'c', quadrant: 'later' },
    );
    s = reduce(s, { type: 'remove', id: 'a' });
    expect(s.tasks.map((t) => t.id)).toEqual(['b', 'c']);
    s = reduce(s, { type: 'toggle', id: 'b', at: T1 });
    s = reduce(s, { type: 'toggle', id: 'c', at: T1 });
    s = reduce(s, { type: 'clearDone', quadrant: 'do' });
    expect(s.tasks.map((t) => t.id)).toEqual(['c']);
    expect(doneTasks(s, 'later').map((t) => t.id)).toEqual(['c']);
  });
});

describe('quadrantFor', () => {
  it('maps the importance/urgency answers onto the four quadrants', () => {
    expect(quadrantFor(true, true)).toBe('do');
    expect(quadrantFor(true, false)).toBe('schedule');
    expect(quadrantFor(false, true)).toBe('delegate');
    expect(quadrantFor(false, false)).toBe('later');
  });
});

describe('persistence', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
  }

  it('round-trips state through storage', () => {
    const storage = memoryStorage();
    const s = withTasks({ id: 'a', title: 'x', quadrant: 'schedule' });
    save(storage, s);
    expect(load(storage)).toEqual(s);
  });

  it('returns an empty state for missing, corrupt, or foreign values', () => {
    expect(load(memoryStorage())).toEqual(emptyState);
    expect(load(memoryStorage({ 'todo-quadrants/v1': 'not json' }))).toEqual(emptyState);
    expect(load(memoryStorage({ 'todo-quadrants/v1': '{"tasks": 42}' }))).toEqual(emptyState);
  });

  it('drops invalid tasks but keeps valid ones', () => {
    const storage = memoryStorage({
      'todo-quadrants/v1': JSON.stringify({
        tasks: [
          { id: 'a', title: 'ok', quadrant: 'do', createdAt: T0, completedAt: null },
          { id: 'b', title: 'bad quadrant', quadrant: 'nope', createdAt: T0, completedAt: null },
          'garbage',
        ],
      }),
    });
    expect(load(storage).tasks.map((t) => t.id)).toEqual(['a']);
  });
});
