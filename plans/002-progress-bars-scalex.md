# 002 — Animate progress and countdown bars with scaleX

- **Status**: DONE (applied)
- **Commit**: 09e3f69
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 3 files, about 6 lines

## Problem
Two bars animate `width`, a layout property:

```css
/* src/styles/components.css:175 — current */
.bar>i{display:block;height:100%;border-radius:4px;background:var(--accent);transition:width 1s linear}
/* src/styles/components.css:187 — current */
.toast-time{height:3px;background:var(--accent-pressed);transition:width 1s linear}
```

and the widths are set inline:
- `src/app/(app)/progress/ProgressView.tsx:70` (`<i style={{ width: ... }}>`)
- `src/app/workout/WorkoutView.tsx` (`<span className="toast-time" style={{ width: ... }} />`)

## Target
Scale instead of resizing, from the left edge, still linear (constant motion):

```css
.bar>i{display:block;width:100%;height:100%;border-radius:4px;background:var(--accent);transform-origin:left center;transition:transform 1s linear}
.toast-time{width:100%;height:3px;background:var(--accent-pressed);transform-origin:left center;transition:transform 1s linear}
```

and in the TSX replace `style={{ width: `${pct}%` }}` with `style={{ transform: `scaleX(${pct / 100})` }}`.

## Repo conventions to follow
- Reduced motion already collapses transitions to 1 ms in `components.css` (`@media (prefers-reduced-motion:reduce)`).

## Steps
1. Edit the two CSS rules as above.
2. In `ProgressView.tsx:70` and the `toast-time` span in `WorkoutView.tsx`, change `width: X%` to `transform: scaleX(X / 100)`.
   Keep the existing clamping (`Math.min(100, ...)`, `Math.max(0, ...)`).

## Boundaries
- Do NOT change the durations or the linear timing.
- Do NOT touch `.dots>i` (it animates width on purpose, in a rare tour).
- If the code differs from the excerpts, STOP and report.

## Verification
- **Mechanical**: `npx tsc --noEmit`, `npm test`, `npm run build` pass.
- **Feel check**: the toast countdown line shrinks smoothly right to left over its lifetime; the Progress bars fill from the left.
