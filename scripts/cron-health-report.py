#!/usr/bin/env python3
"""Formats `supabase db query -f check_cron_health.sql` output for a human.

Reads the CLI's stdout on stdin. Prints one line per job, then a final line of
either ALL OK or PROBLEM followed by the offending jobs.

Separate from cron-health-check.sh because embedding this in `python3 -c '...'`
inside a single-quoted shell string mangles the quoting — the first version
silently produced a syntax error that the script's own 2>/dev/null then hid.

Exit codes: 0 all healthy, 2 something needs attention, 1 unparseable.
"""

import json
import re
import sys

# Verdicts that mean "nothing to do", including the transitional state after a
# deploy where a job simply has not run again yet.
FINE = {"ok", "no run yet"}


def main() -> int:
    raw = sys.stdin.read()
    # The CLI emits {"rows": [...]} when it detects an agent and a bare [...]
    # when it does not, so match either and let the caller pin the format.
    match = re.search(r"(\{.*\}|\[.*\])", raw, re.S)
    if not match:
        print("could not find JSON in the CLI output", file=sys.stderr)
        return 1

    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print(f"could not parse JSON: {e}", file=sys.stderr)
        return 1

    if isinstance(payload, list):
        rows = payload
    else:
        rows = payload.get("result") or payload.get("rows")
        if rows is None:
            rows = next((v for v in payload.values() if isinstance(v, list)), None)
    if not rows:
        print("no rows in the result", file=sys.stderr)
        return 1

    for r in rows:
        when = str(r.get("last_logged") or r.get("last_dispatch") or "—")[:19]
        print(f"  {r['jobname']:<28}{when:<21}{r['verdict']}")

    bad = [r for r in rows if r.get("verdict") not in FINE]
    print("PROBLEM" if bad else "ALL OK")
    for r in bad:
        detail = f" — {str(r['detail'])[:80]}" if r.get("detail") else ""
        print(f"  !! {r['jobname']}: {r['verdict']}{detail}")

    return 2 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
