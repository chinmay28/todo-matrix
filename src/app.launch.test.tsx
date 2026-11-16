import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './app.js';
import { toBackup } from './backup.js';

// The hooks the Android app (apps/android) drives the page through: the
// #add launch hash, the backup menu, and window.todomatrixApp. Each must be
// inert in a plain browser.

type Win = Window & { todomatrixApp?: unknown };

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  delete (window as Win).todomatrixApp;
  vi.restoreAllMocks();
});

function matrixCard(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}:`) });
}

function fakeApp() {
  const app = { platform: 'android', version: 'v2026.11.1', about: vi.fn(), counts: vi.fn() };
  (window as Win).todomatrixApp = app;
  return app;
}

describe('launch hash', () => {
  it('opens the add sheet pre-set to the quadrant a shortcut names, and consumes the hash', () => {
    window.history.replaceState(null, '', '/#add=delegate');
    render(<App />);
    const dialog = screen.getByRole('dialog', { name: 'Add task' });
    expect(dialog).toHaveTextContent('Delegate');
    expect(within(dialog).getByRole('button', { name: 'Important' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(dialog).getByRole('button', { name: 'Urgent' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.location.hash).toBe('');
  });

  it('pre-fills a shared title, then files it where the toggles say', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#add&title=Read+this+article');
    render(<App />);
    const dialog = screen.getByRole('dialog', { name: 'Add task' });
    expect(within(dialog).getByRole('textbox', { name: 'Task title' })).toHaveValue('Read this article');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    // The sheet's own default: important, not urgent.
    expect(matrixCard('Schedule')).toHaveTextContent('Read this article');
  });

  it('reaches a page that is already open, through hashchange', () => {
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, '', '/#add=do&title=Now');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const dialog = screen.getByRole('dialog', { name: 'Add task' });
    expect(dialog).toHaveTextContent('Do');
    expect(within(dialog).getByRole('textbox', { name: 'Task title' })).toHaveValue('Now');
  });

  it('leaves the page alone for any other hash', () => {
    window.history.replaceState(null, '', '/#elsewhere');
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#elsewhere');
  });
});

describe('backup menu', () => {
  it('exports the tasks as a JSON file download', async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:test/1';
    });
    URL.revokeObjectURL = vi.fn();
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });

    render(<App />);
    await user.click(matrixCard('Do'));
    await user.type(screen.getByRole('textbox', { name: 'New task in Do' }), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Back to matrix' }));

    await user.click(screen.getByRole('button', { name: 'Backup and more' }));
    await user.click(screen.getByRole('button', { name: 'Export tasks' }));
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.download).toMatch(/^todo-matrix-\d{4}-\d{2}-\d{2}\.json$/);
    expect(clicks[0]!.href).toBe('blob:test/1');
    const body = JSON.parse(await created[0]!.text());
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(['Keep me']);
    expect(screen.getByRole('status')).toHaveTextContent('Exported 1 task.');
  });

  it('imports a backup by merging it in', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Backup and more' }));
    const file = new File(
      [
        toBackup(
          [{ id: 'x1', title: 'From backup', quadrant: 'later', createdAt: '2026-11-01T00:00:00.000Z', completedAt: null }],
          new Date(),
        ),
      ],
      'todo-matrix-2026-11-01.json',
      { type: 'application/json' },
    );
    await user.upload(screen.getByLabelText('Backup file to import'), file);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Imported 1 task.'));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(matrixCard('Later')).toHaveTextContent('From backup');
  });

  it('says why a file is refused, and changes nothing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Backup and more' }));
    await user.upload(screen.getByLabelText('Backup file to import'), new File(['nope'], 'x.json', { type: 'application/json' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/not a To Do Matrix backup/));
  });

  it('offers no About button in a plain browser', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Backup and more' }));
    expect(screen.queryByRole('button', { name: 'About this app' })).not.toBeInTheDocument();
  });
});

describe('inside the Android app', () => {
  it('posts the open counts on load and after every change', async () => {
    const user = userEvent.setup();
    const app = fakeApp();
    render(<App />);
    expect(app.counts).toHaveBeenLastCalledWith({ do: 0, schedule: 0, delegate: 0, later: 0 });
    await user.click(matrixCard('Do'));
    await user.type(screen.getByRole('textbox', { name: 'New task in Do' }), 'Counted');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(app.counts).toHaveBeenLastCalledWith({ do: 1, schedule: 0, delegate: 0, later: 0 });
  });

  it('opens the native About screen from the menu', async () => {
    const user = userEvent.setup();
    const app = fakeApp();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Backup and more' }));
    await user.click(screen.getByRole('button', { name: 'About this app' }));
    expect(app.about).toHaveBeenCalledOnce();
  });

  it('ignores a window.todomatrixApp that is not the app', async () => {
    const user = userEvent.setup();
    (window as Win).todomatrixApp = { platform: 'ios' };
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Backup and more' }));
    expect(screen.queryByRole('button', { name: 'About this app' })).not.toBeInTheDocument();
  });
});
