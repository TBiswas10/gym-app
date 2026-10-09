/** Is the on-screen keyboard open? The visual viewport shrinks by the keyboard's height; small changes are the URL bar. */
export function keyboardOpen(layoutHeight: number, visualHeight: number): boolean {
  return layoutHeight - visualHeight > 120;
}
