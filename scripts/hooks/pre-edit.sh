#!/bin/bash
# Never let an edit touch secrets or the generated Supabase types by hand.
f=$(python -c "import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
case "$f" in
  *.env|*.env.local|*.env.production|*/.env.*) echo "Blocked: secrets files are never edited by Claude." >&2; exit 2 ;;
esac
exit 0
