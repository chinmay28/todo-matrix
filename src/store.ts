import { isQuadrantId, type QuadrantId, type Task } from './types.js';

export interface State {
  tasks: Task[];
}

export type Action =
  | { type: 'add'; id: string; title: string; quadrant: QuadrantId; at: string }
  | { type: 'toggle'; id: string; at: string }
  | { type: 'move'; id: string; quadrant: QuadrantId }
  | { type: 'rename'; id: string; title: string }
  | { type: 'remove'; id: string }
  | { type: 'clearDone'; quadrant: QuadrantId };

export const emptyState: State = { tasks: [] };

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const title = action.title.trim();
      if (!title) return state;
      const task: Task = {
        id: action.id,
        title,
        quadrant: action.quadrant,
        createdAt: action.at,
        completedAt: null,
      };
      return { tasks: [...state.tasks, task] };
    }
    case 'toggle':
      return mapTask(state, action.id, (t) => ({
        ...t,
        completedAt: t.completedAt === null ? action.at : null,
      }));
    case 'move':
      return mapTask(state, action.id, (t) => ({ ...t, quadrant: action.quadrant }));
    case 'rename': {
      const title = action.title.trim();
      if (!title) return state;
      return mapTask(state, action.id, (t) => ({ ...t, title }));
    }
    case 'remove':
      return { tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'clearDone':
      return {
        tasks: state.tasks.filter(
          (t) => t.quadrant !== action.quadrant || t.completedAt === null,
        ),
      };
  }
}

function mapTask(state: State, id: string, fn: (t: Task) => Task): State {
  return { tasks: state.tasks.map((t) => (t.id === id ? fn(t) : t)) };
}

/** Open tasks of a quadrant, oldest first — the order they were captured in. */
export function openTasks(state: State, quadrant: QuadrantId): Task[] {
  return state.tasks.filter((t) => t.quadrant === quadrant && t.completedAt === null);
}

/** Completed tasks of a quadrant, most recently finished first. */
export function doneTasks(state: State, quadrant: QuadrantId): Task[] {
  return state.tasks
    .filter((t) => t.quadrant === quadrant && t.completedAt !== null)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Persistence: a versioned JSON blob in localStorage. `load` is defensive —
// a corrupt or foreign value must never brick the app, so anything that
// doesn't parse into valid tasks is dropped rather than thrown.

const STORAGE_KEY = 'todo-matrix/v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function load(storage: StorageLike): State {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return emptyState;
  }
  if (raw === null) return emptyState;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyState;
    const tasks = (parsed as { tasks?: unknown }).tasks;
    if (!Array.isArray(tasks)) return emptyState;
    return { tasks: tasks.filter(isTask) };
  } catch {
    return emptyState;
  }
}

export function save(storage: StorageLike, state: State): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks }));
  } catch {
    // Quota exceeded or storage unavailable — the in-memory state still works.
  }
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t['id'] === 'string' &&
    typeof t['title'] === 'string' &&
    isQuadrantId(t['quadrant']) &&
    typeof t['createdAt'] === 'string' &&
    (t['completedAt'] === null || typeof t['completedAt'] === 'string')
  );
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
