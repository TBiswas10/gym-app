// iPhone launch screens: iOS shows one of these (by exact screen size) while a Home Screen app starts. Without a match
// it shows white. Portrait sizes in CSS points, pixel ratio, for the iPhones still in use.
export const SPLASH_SIZES: { w: number; h: number; r: number }[] = [
  { w: 440, h: 956, r: 3 },
  { w: 430, h: 932, r: 3 },
  { w: 428, h: 926, r: 3 },
  { w: 402, h: 874, r: 3 },
  { w: 393, h: 852, r: 3 },
  { w: 390, h: 844, r: 3 },
  { w: 414, h: 896, r: 3 },
  { w: 414, h: 896, r: 2 },
  { w: 375, h: 812, r: 3 },
  { w: 414, h: 736, r: 3 },
  { w: 375, h: 667, r: 2 },
];

export const splashKey = (s: { w: number; h: number; r: number }): string => `${s.w * s.r}x${s.h * s.r}`;

export const splashMedia = (s: { w: number; h: number; r: number }): string =>
  `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: portrait)`;

/** "1170x2532" -> a known size, or null. Only listed sizes are served. */
export function parseSplash(key: string): { w: number; h: number; r: number } | null {
  const hit = SPLASH_SIZES.find((s) => splashKey(s) === key);
  return hit ?? null;
}
