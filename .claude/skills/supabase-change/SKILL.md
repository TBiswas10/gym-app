---
name: supabase-change
description: Make a database change safely for the gym app (project ref yvamsbkfjpgwssporklz): migration, RLS, types, docs. Use for any schema or policy change.
---
# Database change
1. Schema changes only via `apply_migration` (never ad hoc DDL); name the file with the version the DB records (`list_migrations`) and save it under `supabase/migrations`.
2. Every new table: RLS on, policy `user_id = auth.uid()`, restrictive policy for connector tokens (`auth.jwt()->>'client_id'`) unless the owner approved connector access.
3. Data-only seeds use `execute_sql` and idempotent `on conflict`.
4. Regenerate `src/lib/database.types.ts`, run `get_advisors` (security) and fix findings.
5. Log plan edits made by hand in `change_log` so the owner can undo them.
6. Update the Database section of CLAUDE.md, then ship with `ship-gym-app`.
