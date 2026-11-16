import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  doneTasks,
  load,
  newId,
  openCounts,
  openTasks,
  reduce,
  save,
  type Action,
  type State,
} from './store.js';
import {
  QUADRANTS,
  quadrantFor,
  quadrantMeta,
  type QuadrantId,
  type Task,
} from './types.js';
import { DevMark } from './devmark.js';
import { APP_VERSION } from './version.js';
import { parseLaunch, type Launch } from './launch.js';
import { backupFileName, fromBackup, toBackup } from './backup.js';
import { nativeApp } from './native.js';

const PREVIEW_COUNT = 3;

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    load(window.localStorage),
  );
  const [focus, setFocus] = useState<QuadrantId | null>(null);
  // The add sheet's starting point while it is open: the + button opens it
  // blank, a launch (#add=… — a launcher shortcut or text shared to the
  // Android app) opens it pre-set. `seq` remounts it for each new launch.
  const [adding, setAdding] = useState<(Launch & { seq: number }) | null>(null);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  useEffect(() => {
    save(window.localStorage, state);
    // Inside the Android app, the home-screen widget shows these counts.
    nativeApp()?.counts(openCounts(state));
  }, [state]);

  useEffect(() => {
    const take = () => {
      const launch = parseLaunch(window.location.hash);
      if (!launch) return;
      // Consume it, so a reload (or Back) doesn't open the sheet again.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setSelected(null);
      setMenu(false);
      setAdding((prev) => ({ ...launch, seq: (prev?.seq ?? 0) + 1 }));
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
  }, []);

  // The sheet holds a snapshot; keep it in step with the live task so a
  // toggle elsewhere can't act on stale data (and close it if deleted).
  const selectedLive = selected
    ? (state.tasks.find((t) => t.id === selected.id) ?? null)
    : null;

  return (
    <div className="app">
      {focus === null ? (
        <MatrixView
          state={state}
          onOpen={setFocus}
          onAdd={() => setAdding({ quadrant: null, title: '', seq: 0 })}
          onMenu={() => setMenu(true)}
        />
      ) : (
        <FocusView
          state={state}
          quadrant={focus}
          dispatch={dispatch}
          onBack={() => setFocus(null)}
          onSelect={setSelected}
        />
      )}
      {adding && (
        <AddSheet
          key={adding.seq}
          initialQuadrant={adding.quadrant}
          initialTitle={adding.title}
          onClose={() => setAdding(null)}
          onAdd={(title, quadrant) => {
            dispatch({
              type: 'add',
              id: newId(),
              title,
              quadrant,
              at: new Date().toISOString(),
            });
            setAdding(null);
          }}
        />
      )}
      {menu && (
        <MenuSheet
          state={state}
          onImport={(tasks) => dispatch({ type: 'import', tasks })}
          onClose={() => setMenu(false)}
        />
      )}
      {selectedLive && (
        <TaskSheet
          task={selectedLive}
          dispatch={dispatch}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix overview: the whole system on one phone screen. Each quadrant shows
// its count and the first few open tasks; tap to work inside it.

function MatrixView({
  state,
  onOpen,
  onAdd,
  onMenu,
}: {
  state: State;
  onOpen: (q: QuadrantId) => void;
  onAdd: () => void;
  onMenu: () => void;
}) {
  return (
    <>
      <header className="app__header">
        {/* The brand lockup: mark, then the name over the running version.
            The version belongs here rather than in a footer — it tells you at
            a glance whether the build you're looking at is the one you just
            deployed. */}
        <h1 className="app__brand">
          <img src="/favicon.svg" alt="" className="app__brand-logo" />
          <span className="app__brand-text">
            To Do Matrix
            <span className="app__brand-version">{APP_VERSION}</span>
          </span>
        </h1>
        <span className="app__header-end">
          <button
            type="button"
            className="iconbtn"
            onClick={onMenu}
            aria-label="Backup and more"
          >
            ⋯
          </button>
          <DevMark />
        </span>
      </header>
      <main className="matrix" aria-label="Eisenhower matrix">
        <div className="matrix__corner" aria-hidden="true" />
        <div className="matrix__axis matrix__axis--col" aria-hidden="true">
          Urgent
        </div>
        <div className="matrix__axis matrix__axis--col" aria-hidden="true">
          Not urgent
        </div>
        <div className="matrix__axis matrix__axis--row" aria-hidden="true">
          Important
        </div>
        {QUADRANTS.filter((q) => q.important).map((q) => (
          <QuadrantCard key={q.id} state={state} quadrant={q.id} onOpen={onOpen} />
        ))}
        <div className="matrix__axis matrix__axis--row" aria-hidden="true">
          Not important
        </div>
        {QUADRANTS.filter((q) => !q.important).map((q) => (
          <QuadrantCard key={q.id} state={state} quadrant={q.id} onOpen={onOpen} />
        ))}
      </main>
      <button type="button" className="fab" onClick={onAdd} aria-label="Add task">
        +
      </button>
    </>
  );
}

function QuadrantCard({
  state,
  quadrant,
  onOpen,
}: {
  state: State;
  quadrant: QuadrantId;
  onOpen: (q: QuadrantId) => void;
}) {
  const meta = quadrantMeta(quadrant);
  const open = openTasks(state, quadrant);
  const extra = open.length - PREVIEW_COUNT;
  return (
    <button
      type="button"
      className={`quadrant q-${quadrant}`}
      onClick={() => onOpen(quadrant)}
      aria-label={`${meta.name}: ${open.length} open ${open.length === 1 ? 'task' : 'tasks'}`}
    >
      <span className="quadrant__head">
        <span className="quadrant__name">{meta.name}</span>
        <span className="quadrant__count">{open.length}</span>
      </span>
      <span className="quadrant__hint">{meta.hint}</span>
      <span className="quadrant__preview">
        {open.slice(0, PREVIEW_COUNT).map((t) => (
          <span key={t.id} className="quadrant__task">
            {t.title}
          </span>
        ))}
        {extra > 0 && <span className="quadrant__more">+{extra} more</span>}
        {open.length === 0 && <span className="quadrant__empty">Nothing here</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Focus view: one quadrant, full screen. Quick-add files straight into this
// quadrant — no toggles to think about once you're already inside one.

function FocusView({
  state,
  quadrant,
  dispatch,
  onBack,
  onSelect,
}: {
  state: State;
  quadrant: QuadrantId;
  dispatch: (a: Action) => void;
  onBack: () => void;
  onSelect: (t: Task) => void;
}) {
  const meta = quadrantMeta(quadrant);
  const open = openTasks(state, quadrant);
  const done = doneTasks(state, quadrant);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch({
      type: 'add',
      id: newId(),
      title,
      quadrant,
      at: new Date().toISOString(),
    });
    setTitle('');
    inputRef.current?.focus();
  };

  return (
    <>
      <header className={`app__header focus__header q-${quadrant}`}>
        <button type="button" className="focus__back" onClick={onBack} aria-label="Back to matrix">
          ‹
        </button>
        <div className="focus__title">
          <h1 className="focus__name">{meta.name}</h1>
          <span className="focus__hint">
            {meta.important ? 'Important' : 'Not important'} ·{' '}
            {meta.urgent ? 'urgent' : 'not urgent'} — {meta.hint.toLowerCase()}
          </span>
        </div>
        <span className="quadrant__count">{open.length}</span>
      </header>
      <main className="focus">
        {open.length === 0 && done.length === 0 && (
          <p className="focus__empty">No tasks yet. Add one below.</p>
        )}
        <ul className="tasks">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} dispatch={dispatch} onSelect={onSelect} />
          ))}
        </ul>
        {done.length > 0 && (
          <section className="done">
            <div className="done__bar">
              <button
                type="button"
                className="done__toggle"
                aria-expanded={showDone}
                onClick={() => setShowDone((s) => !s)}
              >
                {showDone ? '▾' : '▸'} Completed ({done.length})
              </button>
              {showDone && (
                <button
                  type="button"
                  className="done__clear"
                  onClick={() => dispatch({ type: 'clearDone', quadrant })}
                >
                  Clear
                </button>
              )}
            </div>
            {showDone && (
              <ul className="tasks tasks--done">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} dispatch={dispatch} onSelect={onSelect} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      <form className="quickadd" onSubmit={submit}>
        <input
          ref={inputRef}
          className="quickadd__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Add to ${meta.name}…`}
          aria-label={`New task in ${meta.name}`}
          enterKeyHint="done"
        />
        <button type="submit" className="quickadd__submit" disabled={!title.trim()}>
          Add
        </button>
      </form>
    </>
  );
}

function TaskRow({
  task,
  dispatch,
  onSelect,
}: {
  task: Task;
  dispatch: (a: Action) => void;
  onSelect: (t: Task) => void;
}) {
  const completed = task.completedAt !== null;
  return (
    <li className={`task${completed ? ' task--done' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={completed}
        aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`}
        className="task__check"
        onClick={() =>
          dispatch({ type: 'toggle', id: task.id, at: new Date().toISOString() })
        }
      >
        {completed ? '✓' : ''}
      </button>
      <button
        type="button"
        className="task__body"
        onClick={() => onSelect(task)}
        aria-label={`Edit ${task.title}`}
      >
        {task.title}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheets. Both are plain fixed overlays — no portal or focus-trap
// library; the backdrop click and Close buttons are enough at this size.

function Sheet({ onClose, label, children }: {
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="sheet">
      <button
        type="button"
        className="sheet__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/**
 * Global add: name the task, then answer the only two questions the matrix
 * asks — is it important, is it urgent. The resulting quadrant is spelled
 * out live so the mapping teaches itself.
 */
function AddSheet({
  initialQuadrant = null,
  initialTitle = '',
  onClose,
  onAdd,
}: {
  initialQuadrant?: QuadrantId | null;
  initialTitle?: string;
  onClose: () => void;
  onAdd: (title: string, quadrant: QuadrantId) => void;
}) {
  const initial = initialQuadrant ? quadrantMeta(initialQuadrant) : null;
  const [title, setTitle] = useState(initialTitle);
  const [important, setImportant] = useState(initial?.important ?? true);
  const [urgent, setUrgent] = useState(initial?.urgent ?? false);
  const quadrant = quadrantFor(important, urgent);
  const meta = quadrantMeta(quadrant);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title, quadrant);
  };

  return (
    <Sheet onClose={onClose} label="Add task">
      <form onSubmit={submit} className="addsheet">
        <input
          className="addsheet__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="Task title"
          autoFocus
          enterKeyHint="done"
        />
        <div className="addsheet__toggles">
          <button
            type="button"
            className={`chip${important ? ' chip--on' : ''}`}
            aria-pressed={important}
            onClick={() => setImportant((v) => !v)}
          >
            Important
          </button>
          <button
            type="button"
            className={`chip${urgent ? ' chip--on' : ''}`}
            aria-pressed={urgent}
            onClick={() => setUrgent((v) => !v)}
          >
            Urgent
          </button>
        </div>
        <p className={`addsheet__target q-${quadrant}`}>
          → <strong>{meta.name}</strong> · {meta.hint.toLowerCase()}
        </p>
        <div className="sheet__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            Add task
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** Tap a task → rename it, move it to another quadrant, or delete it. */
function TaskSheet({
  task,
  dispatch,
  onClose,
}: {
  task: Task;
  dispatch: (a: Action) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() && title.trim() !== task.title) {
      dispatch({ type: 'rename', id: task.id, title });
    }
    onClose();
  };

  return (
    <Sheet onClose={onClose} label="Task details">
      <form onSubmit={submit} className="tasksheet">
        <input
          className="addsheet__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Task title"
        />
        <p className="tasksheet__label">Move to</p>
        <div className="tasksheet__moves">
          {QUADRANTS.filter((q) => q.id !== task.quadrant).map((q) => (
            <button
              key={q.id}
              type="button"
              className={`chip q-${q.id}`}
              onClick={() => {
                dispatch({ type: 'move', id: task.id, quadrant: q.id });
                onClose();
              }}
            >
              {q.name}
            </button>
          ))}
        </div>
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              dispatch({ type: 'remove', id: task.id });
              onClose();
            }}
          >
            Delete
          </button>
          <button type="submit" className="btn btn--primary">
            Done
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Backup and more. Tasks live only in this browser's storage, so this is
 * where a person keeps a copy (export, or share it straight to Drive / mail
 * where the browser can share files) and brings one back (import merges —
 * it never removes a task). Inside the Android app it also opens the app's
 * own About screen.
 */
function MenuSheet({
  state,
  onImport,
  onClose,
}: {
  state: State;
  onImport: (tasks: Task[]) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const app = nativeApp();
  const backupFile = () => {
    const at = new Date();
    return new File([toBackup(state.tasks, at)], backupFileName(at), {
      type: 'application/json',
    });
  };
  const canShareFiles = (() => {
    try {
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [backupFile()] });
    } catch {
      return false;
    }
  })();

  const exportTasks = () => {
    const file = backupFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    // Not straight away: the Android app's bridge reads the blob after the
    // click returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setMessage(`Exported ${countLabel(state.tasks.length)}.`);
  };

  const shareTasks = async () => {
    try {
      await navigator.share({ files: [backupFile()], title: 'To Do Matrix backup' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage('Could not share the backup.');
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const result = fromBackup(await file.text());
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onImport(result.tasks);
    const skipped = result.skipped ? ` (${result.skipped} unreadable, skipped)` : '';
    setMessage(`Imported ${countLabel(result.tasks.length)}${skipped}.`);
  };

  return (
    <Sheet onClose={onClose} label="Backup and more">
      <div className="menusheet">
        <p className="tasksheet__label">Backup</p>
        <p className="menusheet__note">
          Your tasks are kept only on this device. Export a backup to keep a copy
          or to move them; importing one adds its tasks to these.
        </p>
        <div className="menusheet__row">
          <button type="button" className="btn" onClick={exportTasks}>
            Export tasks
          </button>
          {canShareFiles && (
            <button type="button" className="btn" onClick={() => void shareTasks()}>
              Share…
            </button>
          )}
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import tasks
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="menusheet__file"
            aria-label="Backup file to import"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {message && (
          <p className="menusheet__message" role="status">
            {message}
          </p>
        )}
        <div className="sheet__actions">
          {app && (
            <button type="button" className="btn menusheet__about" onClick={() => app.about()}>
              About this app
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'task' : 'tasks'}`;
}
