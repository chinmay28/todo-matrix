/** The four Eisenhower quadrants, keyed by the action each one calls for. */
export type QuadrantId = 'do' | 'schedule' | 'delegate' | 'later';

export interface Task {
  id: string;
  title: string;
  quadrant: QuadrantId;
  /** ISO timestamp; also the stable sort key within a quadrant. */
  createdAt: string;
  completedAt: string | null;
}

export interface QuadrantMeta {
  id: QuadrantId;
  name: string;
  /** The one-line answer to "what do I do with tasks here?" */
  hint: string;
  important: boolean;
  urgent: boolean;
}

/**
 * Grid order: urgent on the left, important on top — so reading order goes
 * Do, Schedule, Delegate, Later (most to least deserving of attention).
 */
export const QUADRANTS: readonly QuadrantMeta[] = [
  { id: 'do', name: 'Do', hint: 'Do it now', important: true, urgent: true },
  { id: 'schedule', name: 'Schedule', hint: 'Decide when', important: true, urgent: false },
  { id: 'delegate', name: 'Delegate', hint: 'Hand it off', important: false, urgent: true },
  { id: 'later', name: 'Later', hint: 'Drop or defer', important: false, urgent: false },
];

export function quadrantMeta(id: QuadrantId): QuadrantMeta {
  const meta = QUADRANTS.find((q) => q.id === id);
  if (!meta) throw new Error(`unknown quadrant: ${id}`);
  return meta;
}

export function quadrantFor(important: boolean, urgent: boolean): QuadrantId {
  if (important) return urgent ? 'do' : 'schedule';
  return urgent ? 'delegate' : 'later';
}

export function isQuadrantId(value: unknown): value is QuadrantId {
  return QUADRANTS.some((q) => q.id === value);
}
