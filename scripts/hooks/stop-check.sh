#!/bin/bash
# Before Claude ends a turn: if source files changed, the full check must pass. Failing output goes back to Claude. Runs once per turn (no loop).
in=$(cat)
echo "$in" | python -c "import sys,json;sys.exit(0 if json.load(sys.stdin).get('stop_hook_active') else 1)" 2>/dev/null && exit 0
cd "$(dirname "$0")/../.."
git status --porcelain -- src scripts/check.sh package.json | grep -q . || exit 0
out=$(bash scripts/check.sh 2>&1)
if ! echo "$out" | grep -q "ALL CHECKS PASSED"; then echo "$out" | tail -40 >&2; exit 2; fi
exit 0
