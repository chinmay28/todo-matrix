import type { QuadrantId } from './types.js';

/**
 * The Android app, when the page is running inside it.
 *
 * The app's bridge script (apps/android/app/src/main/assets/
 * todomatrix-bridge.js) defines `window.todomatrixApp` before any of the
 * page's own scripts run; in a browser it is simply absent. Everything the
 * page does with it is feature-detected through here, so a plain browser
 * behaves exactly as it did before the app existed.
 */
export interface NativeApp {
  platform: 'android';
  /** The APK's version name. */
  version: string;
  /** Open the app's native About screen. */
  about(): void;
  /** The open-task count of each quadrant, for the home-screen widget. */
  counts(counts: Record<QuadrantId, number>): void;
}

export function nativeApp(): NativeApp | null {
  const app = (window as Window & { todomatrixApp?: Partial<NativeApp> }).todomatrixApp;
  if (!app || app.platform !== 'android') return null;
  if (typeof app.about !== 'function' || typeof app.counts !== 'function') return null;
  return app as NativeApp;
}
