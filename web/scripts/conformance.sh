#!/usr/bin/env bash
# Run the reference conformance suite the only way it gives trustworthy numbers:
# against a PRODUCTION build, sequentially.
#
# Why not `next dev` (Findings.md F-049): MonthField and TimeField reveal on
# hydration, growing the shared page by +224 px. In dev that lands at
# t ≈ 330–410 ms — inside Playwright's click gesture, which computes a point and
# then moves the mouse. Triggers end up 212 px below the aim, so clicks dispatch
# on an ancestor and four unrelated components fail with messages accusing their
# own mechanisms. In production the shift completes at t = 66 ms, before the first
# action. Measured: ToggleTip 6/5 dev vs 11/11 prod, with no code difference.
#
# Why sequentially: concurrent runs from the submodule's single Playwright
# install produce a bogus "did not expect test.beforeEach() ... No tests found"
# runner error rather than a clean failure.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/web"
SUB="$ROOT/reference-components"
PORT="${PORT:-3200}"
BASE="http://localhost:$PORT"

COMPONENTS=(AffixField ChoiceField ChoiceGroup DateField DateTimeField FileUpload
            MonthField MotionRegion Notice Picklist RangeField RangeGroup
            RangeScale ScrollArea ThemeSwitch TimeField ToggleTip WeekField)
SITE=(appearance text-spacing)

# Match the RUNNER, not the pattern. `pgrep -f "playwright test"` also matches
# every shell that merely mentions it — a wait loop, another agent's guard, this
# script's own command line — so with several agents active it self-blocks and
# every waiter waits for every other waiter. Match the binary instead.
if pgrep -fl "\.bin/playwright" >/dev/null 2>&1; then
  echo "refusing to run: a playwright runner is active (see header)" >&2
  exit 1
fi

echo "building…"
( cd "$WEB" && npm run build >/dev/null 2>&1 ) || { echo "build failed" >&2; exit 1; }

started=""
if ! curl -s -o /dev/null "$BASE/" 2>/dev/null; then
  echo "starting production server on port ${PORT}"
  ( cd "$WEB" && PORT="$PORT" npm run start >/tmp/conformance-prod.log 2>&1 & )
  started=1
  for _ in $(seq 1 60); do curl -s -o /dev/null "$BASE/" 2>/dev/null && break; sleep 1; done
fi

pass=0; fail=0
run() {  # $1 = label, $2 = spec path
  printf '%-15s' "$1"
  out=$( cd "$SUB" && BASE_URL="$BASE" npx playwright test "$2" --reporter=line \
         --output="$WEB/tasks/conformance/$1" 2>&1 )
  p=$(printf '%s' "$out" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | tail -1)
  f=$(printf '%s' "$out" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | tail -1)
  p=${p:-0}; f=${f:-0}
  pass=$((pass + p)); fail=$((fail + f))
  printf '%3s passed  %2s failed%s\n' "$p" "$f" "$([ "$f" -gt 0 ] && echo '   <--')"
}

for c in "${COMPONENTS[@]}"; do
  run "$c" "src/partials/components/$c/tests/$c.e2e.test.js"
done
echo "---"
for s in "${SITE[@]}"; do run "$s" "tests/$s.e2e.test.js"; done

echo "======================================="
printf 'TOTAL           %3s passed  %2s failed\n' "$pass" "$fail"
echo
echo "submodule cleanliness:"
git -C "$SUB" status --short | sed 's/^/  /' || true
git -C "$SUB" status --short | grep -q . && echo "  ** NOT CLEAN **" || echo "  clean"

# NOTE: `pkill -f "next start"` does NOT match — the running process is named
# `next-server`, so that pattern is a silent no-op. A restart then hits
# EADDRINUSE, `next start` never binds, and the OLD server keeps answering 200
# from a .next that later builds have overwritten: unstyled page, dead JS, stale
# HTML. That exact trap produced three wrong reports in this project before the
# cause was found. Kill by port, and verify.
[ -n "$started" ] && {
  echo; echo "stopping production server"
  pkill -f "next-server" >/dev/null 2>&1
  pid=$(lsof -ti:"$PORT" 2>/dev/null) && [ -n "$pid" ] && kill -9 $pid >/dev/null 2>&1
}
exit 0
