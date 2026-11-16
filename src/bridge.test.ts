import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The Android app's page bridge (apps/android/app/src/main/assets/
// todomatrix-bridge.js), run here against jsdom with the native side played
// by a fake port: the contract between the script and core/Bridge.kt.

// vitest runs from the repository root.
const SCRIPT = readFileSync(
  resolve(process.cwd(), 'apps/android/app/src/main/assets/todomatrix-bridge.js'),
  'utf8',
).replace('"__TODOMATRIX_VERSION__"', JSON.stringify('v2026.11.7'));

type Msg = Record<string, unknown> & { t: string; re: number };
type Win = Window & { TodoMatrixAndroid?: unknown; todomatrixApp?: unknown };

const originalClick = HTMLAnchorElement.prototype.click;

/** A native side that answers every request the way PageBridge does. */
function installPort() {
  const sent: Msg[] = [];
  const listeners: Array<(e: { data: string }) => void> = [];
  const reply = (o: object) => setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify(o) })));
  (window as Win).TodoMatrixAndroid = {
    addEventListener: (_: string, l: (e: { data: string }) => void) => listeners.push(l),
    postMessage: (text: string) => {
      const m = JSON.parse(text) as Msg;
      sent.push(m);
      if (m.re === 0) return;
      if (m.t === 'begin') reply({ re: m.re, ok: true, id: 't1' });
      // A staged file's end answers with its id, a saved one's with its name.
      else if (m.t === 'end') reply({ re: m.re, ok: true, id: m['id'], name: 'saved.json' });
      else reply({ re: m.re, ok: true });
    },
  };
  new Function(SCRIPT)();
  return sent;
}

beforeEach(() => {
  delete (window as Win).todomatrixApp;
});

afterEach(() => {
  delete (window as Win).TodoMatrixAndroid;
  delete (window as Win).todomatrixApp;
  HTMLAnchorElement.prototype.click = originalClick;
  vi.unstubAllGlobals();
});

describe('todomatrix-bridge.js', () => {
  it('does nothing outside the app (no port)', () => {
    new Function(SCRIPT)();
    expect((window as Win).todomatrixApp).toBeUndefined();
  });

  it('defines window.todomatrixApp with the version stamped in', () => {
    installPort();
    expect((window as Win).todomatrixApp).toMatchObject({ platform: 'android', version: 'v2026.11.7' });
  });

  it('posts counts and About as one-way messages', () => {
    const sent = installPort();
    const app = (window as Win).todomatrixApp as { counts(c: object): void; about(): void };
    app.counts({ do: 1, schedule: 2, delegate: 0, later: 3 });
    app.about();
    expect(sent).toEqual([
      { t: 'counts', re: 0, counts: { do: 1, schedule: 2, delegate: 0, later: 3 } },
      { t: 'about', re: 0 },
    ]);
  });

  it('turns a blob download into begin, chunks and end, with the bytes intact', async () => {
    const sent = installPort();
    const body = '{"tasks":[]}\n';
    vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob([body], { type: 'application/json' }) }));
    const a = document.createElement('a');
    a.href = 'blob:https://appassets.androidplatform.net/1';
    a.download = 'todo-matrix-2026-11-16.json';
    a.click();
    await vi.waitFor(() => expect(sent.at(-1)?.t).toBe('end'));
    expect(sent[0]).toMatchObject({ t: 'begin', name: 'todo-matrix-2026-11-16.json', mime: 'application/json', size: body.length, action: 'save' });
    const chunks = sent.filter((m) => m.t === 'chunk');
    expect(chunks.map((c) => c['seq'])).toEqual([0]);
    expect(atob(String(chunks[0]!['data']))).toBe(body);
    expect(sent.at(-1)).toMatchObject({ t: 'end', id: 't1' });
  });

  it('leaves ordinary anchors to the browser', () => {
    const seen: string[] = [];
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      seen.push(this.href);
    };
    const sent = installPort();
    const a = document.createElement('a');
    a.href = 'https://github.com/chinmay28/todo-matrix';
    a.click();
    expect(seen).toEqual(['https://github.com/chinmay28/todo-matrix']);
    expect(sent).toEqual([]);
  });

  it('shares files by staging them, then asking for the sheet', async () => {
    const sent = installPort();
    const file = new File(['x'], 'b.json', { type: 'application/json' });
    expect(navigator.canShare({ files: [file] })).toBe(true);
    await navigator.share({ files: [file], title: 'To Do Matrix backup' });
    expect(sent.map((m) => m.t)).toEqual(['begin', 'chunk', 'end', 'share']);
    expect(sent[0]).toMatchObject({ action: 'stage', name: 'b.json' });
    expect(sent.at(-1)).toMatchObject({ t: 'share', ids: ['t1'], title: 'To Do Matrix backup' });
  });
});
