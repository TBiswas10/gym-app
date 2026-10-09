/** Is the on-screen keyboard open? The visual viewport shrinks by the keyboard's height; small changes are the URL bar. */
export function keyboardOpen(layoutHeight: number, visualHeight: number): boolean {
  return layoutHeight - visualHeight > 120;
}

/** iPhone Home Screen apps with a translucent status bar can report a window shorter than the screen by about the
 *  status bar's height. Returns the full screen height to use when that happens, otherwise null. */
export function fullScreenHeight(standalone: boolean, layoutHeight: number, screenHeight: number): number | null {
  const gap = screenHeight - layoutHeight;
  return standalone && gap > 0 && gap <= 60 ? screenHeight : null;
}
