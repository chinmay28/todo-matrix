/**
 * iOS home-screen web apps can compute CSS viewport units — vh, dvh, even
 * lvh — against a phantom Safari toolbar (a long-standing WebKit bug, worst
 * on the legacy web-clip path a plain-HTTP install takes), which strands the
 * shell ~a-toolbar's-height above the real bottom of the screen. No unit is
 * immune, so CSS alone can't fix it.
 *
 * `screen.width/height` report the physical screen regardless, and
 * `navigator.standalone` is iOS-only and true exactly in home-screen apps —
 * so in that mode (and only there) pin the true screen height into
 * `--app-height`, which styles.css applies to the shell under the
 * `.ios-standalone` class. Everywhere else this is a no-op and the 100lvh
 * rules stand.
 *
 * iOS reports screen.width/height in portrait terms regardless of the
 * current orientation; picking by max/min against the orientation query is
 * robust either way.
 */
export function pinStandaloneViewport(): void {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone !== true) return;

  const root = document.documentElement;
  const apply = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const h = portrait
      ? Math.max(window.screen.width, window.screen.height)
      : Math.min(window.screen.width, window.screen.height);
    root.style.setProperty('--app-height', `${h}px`);
    root.classList.add('ios-standalone');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
