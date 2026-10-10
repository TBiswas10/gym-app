# Animation audit (find-animation-opportunities + improve-animations)

Commit `09e3f69`. Read-only analysis: no source file was changed. Plans are in `/plans`.

## Recon
- **Stack:** Next.js 16, plain CSS, no motion library. Easing/duration tokens in `src/styles/tokens.css`:
  `--dur-press 120ms`, `--dur-base 200ms`, `--dur-celebrate 400ms`, `--ease-out cubic-bezier(.2,.8,.2,1)`, `--ease-in`.
- **Where motion lives:** `components.css` (press, toast, sheet, pop, burst), `screens.css` (rings, tab indicator, rest pulse,
  banners, exercise photo flip), and inline pointer handlers (`SwipeTabs`, `EdgeBack`, `NumField`, `useSwipeUp`).
- **Personality:** crisp training tool. Delight is allowed only at rare moments (finish tick, new best).
- **Frequency map:** press feedback and tab switches are daily and many times a day; sheets/toasts occasional;
  finish tick, new best and first-run tour are rare.

## Vetted findings (by leverage)
| # | Sev | Category | Location | Finding | Plan |
|---|---|---|---|---|---|
| 1 | MEDIUM | Performance | `screens.css:97` | `.tab-ind` animates `left` (a layout property) on every tab switch, the most frequent navigation. | 001 |
| 2 | LOW | Performance | `components.css:175,187` | `.bar>i` and `.toast-time` animate `width` (layout). Linear constant motion is right; the property is not. | 002 |
| 3 | LOW | Easing | `tokens.css:44` | `--ease-out` is `cubic-bezier(.2,.8,.2,1)`, softer than the standard strong ease-out `cubic-bezier(.23,1,.32,1)`. Every entrance would feel crisper. Needs the owner's OK (token from the design handoff). | 003 |
| 4 | LOW | Interruptibility | `components.css:217`, `screens.css:92` | Toast/banner entrance uses `@keyframes` (restarts from zero). Acceptable at current frequency; note only. | none |

Already right (not reported): press feedback 100–160 ms ease-out, sheet exits symmetric and ease-out, no `transition: all`,
no `scale(0)`, `prefers-reduced-motion` honoured, motion limited to transform/opacity except items 1–2, pointer-driven
gestures (scrub, swipe, pull) carry velocity or follow the finger directly.

## Missed opportunities (additive)
1. **Plan editor accordion snaps open** (`PlanView.tsx:140`, `aria-expanded`). Purpose: preventing a jarring change.
   Frequency: occasional. Motion: grid-rows `0fr → 1fr` + opacity, 200 ms `var(--ease-out)`; collapse 150 ms.
2. **Today day-strip selection swaps the card instantly** (`TodayView.tsx:118`). Purpose: spatial consistency.
   Frequency: a few times per visit. Motion: new card fades/translates in 8 px, 160 ms ease-out (`anim-in` already exists).

## Rejected (and why)
- Exercise-to-exercise card swap in a workout: ~12 times per session and the user is mid-set. **Frequency.**
- Progress line chart drawing in: functional data the user is reading. **Function.**
- Weight/reps number changes while scrubbing: direct manipulation, must follow the finger with no easing. **Function.**
- Library photo flip is already a slow decorative loop, kept to the guide only. **Leave as is.**

## Verdict
The app is already close to right: little motion, and it is concentrated on feedback and rare celebrations. The one
change that matters for daily feel is #1 (the tab indicator runs on every tab switch and should be a transform).
#3 is the highest-leverage one-liner but changes a design-handoff token, so it waits for approval.
