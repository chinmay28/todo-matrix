import { isQuadrantId, type QuadrantId } from './types.js';

/**
 * A request, carried in the address's hash, to open the add sheet — how the
 * Android app's launcher shortcuts ("Add to Do") and its share target (text
 * shared from another app becomes a task's title) reach the page, and how the
 * installed PWA's own manifest shortcuts do the same.
 *
 *   #add                      the add sheet, as the + button opens it
 *   #add=do                   pre-set to a quadrant (do|schedule|delegate|later)
 *   #add=schedule&title=Call  … and with the title already typed
 *
 * The hash, not the path or the query: it never reaches a server, so the
 * self-hosted serve.mjs and the app's asset loader serve the same index.html
 * whatever it says, and changing it on a loaded page fires `hashchange`
 * rather than reloading — which is how a shortcut reaches an app already open.
 */
export interface Launch {
  /** The quadrant to pre-select, or null for the sheet's own default. */
  quadrant: QuadrantId | null;
  /** The title to pre-fill ('' for none). */
  title: string;
}

/** Longer than any real task title; stops a whole shared article landing in one. */
export const MAX_TITLE = 500;

/** The launch a hash asks for, or null when it asks for none. */
export function parseLaunch(hash: string): Launch | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('add')) return null;
  const q = params.get('add');
  return {
    quadrant: isQuadrantId(q) ? q : null,
    title: cleanTitle(params.get('title') ?? ''),
  };
}

/** The hash that asks for [launch] — the inverse of parseLaunch. */
export function launchHash(launch: Launch): string {
  const params = new URLSearchParams();
  params.set('add', launch.quadrant ?? '');
  if (launch.title) params.set('title', launch.title);
  // `add=` with no value reads more plainly as bare `add`.
  return `#${params.toString().replace(/^add=(&|$)/, 'add$1')}`;
}

/** One line, trimmed and capped: what a task title can hold. */
function cleanTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE).trim();
}
