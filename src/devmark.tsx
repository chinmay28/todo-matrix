import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** How long the developer badge stays up when the header mark is tapped.
 *  Kept in sync with the fade/scale animation in styles.css — the CSS runs on
 *  its own clock, this unmounts it. */
const DEV_FLASH_MS = 3000;

/* The developer credit mark (shared across the developer's apps — see
   sand-vault). The artwork is a dark badge in its own right, so it stays dark
   regardless of theme and hangs off a hairline divider in the header. */
export function DevMark() {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), DEV_FLASH_MS);
    // Nobody should be stuck waiting out an animation — Escape ends it early,
    // as does a click anywhere on the overlay.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlash(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [flash]);

  return (
    <>
      <button
        type="button"
        className="devmark"
        aria-label="Show the developer badge"
        onClick={() => setFlash(true)}
      >
        {/* The button carries the label; the image would only repeat it. */}
        <img src="/dev-badge.png" alt="" aria-hidden="true" className="devmark__img" />
      </button>
      {/* Portalled to the body so "full screen" stays true wherever the mark
          is rendered from. */}
      {flash &&
        createPortal(
          <div className="devflash" onClick={() => setFlash(false)}>
            <div className="devflash__lockup">
              <img
                src="/dev-badge-full.png"
                alt="Built by CM Hegday — 0x434d"
                className="devflash__badge"
              />
              {/* Monospace to echo the badge's own wordmark, tracked out so it
                  reads as a signature under the mark rather than body copy. */}
              <span className="devflash__handle">github.com/chinmay28</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
