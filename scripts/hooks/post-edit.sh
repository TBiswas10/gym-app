#!/bin/bash
# After Claude edits a TS/TSX file under src/, lint just that file (fast). Exit 2 sends the findings back to Claude.
f=$(python -c "import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
case "$f" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
case "$f" in
  */src/*|src/*) ;;
  *) exit 0 ;;
esac
out=$(cd "$(dirname "$0")/../.." && npx oxlint --deny-warnings "$f" 2>&1)
if [ $? -ne 0 ]; then echo "$out" | tail -20 >&2; exit 2; fi
exit 0
