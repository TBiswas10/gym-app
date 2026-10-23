#!/bin/bash
# Types, lint, tests. Stops at the first failure and prints only the useful part.
cd "$(dirname "$0")/.."
npx tsc --noEmit 2>&1 | head -30; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "TYPECHECK FAILED"; exit 1; }
npm run lint 2>&1 | tail -25; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "LINT FAILED"; exit 1; }
npx vitest run 2>&1 | grep -E "FAIL|Tests |Test Files|Error" | head -30; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "TESTS FAILED"; exit 1; }
echo "ALL CHECKS PASSED"
