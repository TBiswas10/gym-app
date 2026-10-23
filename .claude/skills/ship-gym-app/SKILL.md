---
name: ship-gym-app
description: Check, commit, push and deploy the gym app to production, then verify the live build. Use whenever a change is ready to ship.
---
# Ship the gym app
Run from the repo root, stop at the first failure and fix the cause (never skip hooks or tests):
1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.
2. Update CLAUDE.md if behaviour, structure or rules changed (keep it factual, one bullet per feature).
3. `git add` only the files you changed (never `.env*`, `_renders/`, `skills-lock.json`), commit with a plain-English message ending with the Co-Authored-By line given in the session, `git push`.
4. `vercel deploy --prod --yes`, then `curl -s https://gym-app-one-xi.vercel.app/api/version` and confirm the build id equals `git rev-parse HEAD`.
5. If the build refuses a package for a security advisory, upgrade to the patched release and re-run step 1.
Report: what shipped, test count, anything not verified on a phone.
