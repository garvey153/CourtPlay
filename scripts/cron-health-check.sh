#!/bin/bash
#
# Runs supabase/check_cron_health.sql and says something only when it matters.
#
# Install as a daily LaunchAgent (8am local):
#
#   scripts/cron-health-check.sh --install
#
# Remove it:
#
#   launchctl bootout gui/$(id -u)/app.courtplay.cron-health
#   rm ~/Library/LaunchAgents/app.courtplay.cron-health.plist
#
# Run it by hand any time:
#
#   scripts/cron-health-check.sh
#
# A failure to RUN the check is reported differently from a job that failed.
# Conflating the two is what this whole health-check exercise has been about:
# an expired login or no network is not a broken cron job, and a notification
# that says it is trains you to ignore the next real one.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$HOME/Library/Logs/courtplay-cron-health.log"
LABEL="app.courtplay.cron-health"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# launchd hands us a minimal PATH, and nvm's node is not on it. Resolve the
# newest installed version rather than pinning one that a node upgrade breaks.
if [ -d "$HOME/.nvm/versions/node" ]; then
    NODE_BIN="$(/bin/ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
    [ -n "$NODE_BIN" ] && PATH="$NODE_BIN:$PATH"
fi
export PATH

notify() {
    /usr/bin/osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1 || true
}

log() {
    mkdir -p "$(dirname "$LOG")"
    printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG"
}

install_agent() {
    mkdir -p "$(dirname "$PLIST")"
    cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$REPO/scripts/cron-health-check.sh</string>
    </array>
    <!-- Local time. game-reminders fires at 09:00 UTC (05:00 ET), so 8am local
         is comfortably after every job has run. -->
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>8</integer>
        <key>Minute</key><integer>0</integer>
    </dict>
    <!-- Catch up if the Mac was asleep at 8am rather than skipping the day. -->
    <key>RunAtLoad</key><false/>
    <key>StandardOutPath</key><string>$LOG</string>
    <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF

    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
    if launchctl bootstrap "gui/$(id -u)" "$PLIST"; then
        echo "Installed $LABEL — runs daily at 8:00am local."
        echo "  plist: $PLIST"
        echo "  log:   $LOG"
    else
        echo "Failed to load $PLIST" >&2
        exit 1
    fi
}

[ "${1:-}" = "--install" ] && { install_agent; exit 0; }

cd "$REPO" || { log "CHECK FAILED — repo not found at $REPO"; exit 1; }

# --output-format json is not optional: without it the CLI prints JSON only when
# it detects an agent, and a human table otherwise. Under launchd that produced a
# box-drawing table and the check reported a failure that did not exist.
raw="$(npx --yes supabase --output-format json db query --linked -f supabase/check_cron_health.sql 2>&1)"
status=$?

# Anything that stopped us reaching an answer: no network, expired login, a
# changed CLI. Not a cron failure, and deliberately worded so it can't read as one.
if [ $status -ne 0 ] || ! printf '%s' "$raw" | grep -q '"jobname"'; then
    summary="$(printf '%s' "$raw" | tail -3 | tr '\n' ' ' | cut -c1-200)"
    log "CHECK FAILED — could not read cron health: $summary"
    notify "CourtPlay — cron check failed" "Could not reach the database. This is the check, not the jobs."
    exit 1
fi

# Parser lives in its own file: embedding it here mangles the quoting, and the
# first attempt failed silently because stderr was discarded. Errors are kept now.
printf '%s' "$raw" | python3 "$REPO/scripts/cron-health-report.py" > /tmp/cron-health-out.$$ 2>/tmp/cron-health-err.$$

if [ ! -s /tmp/cron-health-out.$$ ]; then
    why="$(cat /tmp/cron-health-err.$$ 2>/dev/null | tr '\n' ' ' | cut -c1-160)"
    log "CHECK FAILED — could not parse the result: $why"
    notify "CourtPlay — cron check failed" "Could not parse the result. This is the check, not the jobs."
    rm -f /tmp/cron-health-out.$$ /tmp/cron-health-err.$$
    exit 1
fi

body="$(cat /tmp/cron-health-out.$$)"
rm -f /tmp/cron-health-out.$$ /tmp/cron-health-err.$$

# When run by hand, show the table. Under launchd this goes to the log anyway.
[ -t 1 ] && printf '%s\n' "$body"

if printf '%s' "$body" | grep -q '^PROBLEM'; then
    detail="$(printf '%s' "$body" | grep '^  !!' | sed 's/^  !! //' | tr '\n' '; ' | cut -c1-200)"
    log "PROBLEM — $detail"
    notify "CourtPlay cron needs attention" "$detail"
    exit 2
fi

# Silent on success: a notification every morning saying nothing is wrong is a
# notification you stop reading.
log "ALL OK — $(printf '%s' "$body" | grep -c '^  ') jobs healthy"
exit 0
