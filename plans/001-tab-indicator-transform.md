# 001 — Animate the tab indicator with transform, not left

- **Status**: DONE (applied)
- **Commit**: 09e3f69
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file (`src/styles/screens.css`), 2 lines

## Problem
The sliding tab indicator moves by transitioning `left`, which triggers layout on every tab switch:

```css
/* src/styles/screens.css:97 — current */
.tab-ind{position:absolute;top:0;left:calc(var(--space-2) + (100% - var(--space-4)) / 4 * var(--i,0));width:calc((100% - var(--space-4)) / 4);display:flex;justify-content:center;transition:left var(--dur-base) var(--ease-out);pointer-events:none}
```

## Target
Keep `left` fixed and move with `transform: translateX`, which is compositor-only:

```css
.tab-ind{position:absolute;top:0;left:var(--space-2);width:calc((100% - var(--space-4)) / 4);display:flex;justify-content:center;transform:translateX(calc(var(--i,0) * 100%));transition:transform var(--dur-base) var(--ease-out);pointer-events:none}
```

(`100%` in `translateX` is the element's own width, which is exactly one tab.)

## Repo conventions to follow
- Durations/easing are `var(--dur-base)` (200ms) and `var(--ease-out)` from `src/styles/tokens.css`.
- `--i` is set inline on `<nav className="tabbar">` in `src/components/TabBar.tsx`.

## Steps
1. In `src/styles/screens.css`, replace the `.tab-ind{...}` rule on line 97 with the Target rule above.
2. Do not touch `.tab-ind::before`.

## Boundaries
- Do NOT change `TabBar.tsx` or the markup.
- Do NOT add dependencies.
- If line 97 no longer matches, STOP and report.

## Verification
- **Mechanical**: `npx tsc --noEmit` and `npm run build` pass.
- **Feel check**: on a phone, tap each tab and swipe between tabs. The lime bar slides to the new tab in about 200 ms
  with no jitter or flash, including when tapping rapidly across several tabs.
