# 003 — Use the strong ease-out as the shared curve (needs owner approval)

- **Status**: TODO (blocked: changes a design-handoff token, owner must approve)
- **Commit**: 09e3f69
- **Severity**: LOW
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1 line (affects all motion)

## Problem
The shared `--ease-out` is soft. The standard strong ease-out starts faster, which makes every press, sheet and banner feel more immediate:

```css
/* src/styles/tokens.css:44 — current */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
```

## Target
```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```

## Repo conventions to follow
- `tokens.css` is generated from the design handoff; `CLAUDE.md` says no new curves without approval, so record the change
  in `CLAUDE.md` ("Motion and feel") when applying.

## Steps
1. Get the owner's OK.
2. Edit line 44 of `src/styles/tokens.css` to the Target value.
3. Add one line under "Motion and feel" in `CLAUDE.md`: "`--ease-out` is cubic-bezier(0.23, 1, 0.32, 1) (owner approved)".

## Boundaries
- Do NOT edit `--ease-in` or any duration token.
- Do NOT change any component CSS.

## Verification
- **Mechanical**: `npm run build` passes.
- **Feel check**: press buttons, open the guide sheet, drop a banner: entrances should snap in slightly faster and settle
  gently. If anything feels abrupt, revert the one line.
