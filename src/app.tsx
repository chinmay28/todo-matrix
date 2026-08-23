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

const PREVIEW_COUNT = 3;

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    load(window.localStorage),
  );
  const [focus, setFocus] = useState<QuadrantId | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  useEffect(() => {
    save(window.localStorage, state);
  }, [state]);

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
          onAdd={() => setAdding(true)}
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
          onClose={() => setAdding(false)}
          onAdd={(title, quadrant) => {
            dispatch({
              type: 'add',
              id: newId(),
              title,
              quadrant,
              at: new Date().toISOString(),
            });
            setAdding(false);
          }}
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
}: {
  state: State;
  onOpen: (q: QuadrantId) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <header className="app__header">
        <h1 className="app__brand">
          <img src="/favicon.svg" alt="" className="app__brand-logo" />
          To Do Matrix
        </h1>
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
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (title: string, quadrant: QuadrantId) => void;
}) {
  const [title, setTitle] = useState('');
  const [important, setImportant] = useState(true);
  const [urgent, setUrgent] = useState(false);
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
