/** 30 -> "30", 32.5 -> "32.5". Weights are kilograms; the UI adds the unit. */
export const fmtNum = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return r % 1 ? r.toFixed(1) : String(Math.round(r));
};
