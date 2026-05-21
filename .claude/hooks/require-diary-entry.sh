#!/bin/bash
# Force a UTF-8 locale so `grep -P` (Perl regex) works under Git Bash on
# Windows. The default Windows codepage locale produces:
#   "grep: -P supports only unibyte and UTF-8 locales"
# which silently empties the JSON-extraction pipelines below.
export LC_ALL=C.UTF-8

# Embranch: Require recent diary entry OR jot before file edits
# PreToolUse hook for Edit|Write
# Exit 0 = allow, Exit 2 = block with message
#
# Checks (in order):
#   1. Jot marker file (.last_jot_ts) — fast local check
#   2. Daemon REST API (diary-status) — fallback for flushed entries
#
# Environment variables:
#   EMBRANCH_HOOKS_DISABLED=1  — skip all Embranch hooks
#   EMBRANCH_ISSUE_ID          — current issue (e.g., EMBR-194)
#   EMBRANCH_DATA_PATH         — Embranch data directory (for jot marker)
#   EMBRANCH_DAEMON_PORT       — daemon port (default: 8765)
#   EMBRANCH_DIARY_THRESHOLD   — seconds threshold (default: 1200 = 20 min)

# Consume stdin (required — Claude Code sends tool input JSON)
cat > /dev/null 2>&1 &

# Skip if hooks disabled
if [ "${EMBRANCH_HOOKS_DISABLED:-0}" = "1" ]; then exit 0; fi

# Read current issue from environment
ISSUE_ID="${EMBRANCH_ISSUE_ID:-}"
if [ -z "$ISSUE_ID" ]; then
  exit 0  # No issue context — not in diary workflow
fi

THRESHOLD="${EMBRANCH_DIARY_THRESHOLD:-1200}"

# --- Check 1: Jot marker file (fast, no network) ---
DATA_PATH="${EMBRANCH_DATA_PATH:-.embranch}"
JOT_MARKER="${DATA_PATH}/.last_jot_ts"
if [ -f "$JOT_MARKER" ]; then
  JOT_TS=$(cat "$JOT_MARKER" 2>/dev/null)
  if [ -n "$JOT_TS" ]; then
    NOW=$(date +%s)
    JOT_AGE=$(( NOW - JOT_TS ))
    if [ "$JOT_AGE" -lt "$THRESHOLD" ] 2>/dev/null; then
      exit 0  # Recent jot exists — allow edit
    fi
  fi
fi

# --- Check 2: Daemon API (for entries already flushed to diary) ---
DAEMON_PORT="${EMBRANCH_DAEMON_PORT:-8765}"
DAEMON_URL="http://localhost:${DAEMON_PORT}/api/v1/diary-status"

RESPONSE=$(curl -s --max-time 1 \
  "${DAEMON_URL}?collection=dev-diary&issue_id=${ISSUE_ID}" 2>/dev/null)

# shellcheck disable=SC2181
if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
  exit 0  # Daemon not available — graceful degradation
fi

# Parse response (jq if available, fallback to grep)
if command -v jq &>/dev/null; then
  TOTAL=$(echo "$RESPONSE" | jq -r '.total_entries // 0')
  SECONDS_SINCE=$(echo "$RESPONSE" | jq -r '.seconds_since_last // "null"')
else
  TOTAL=$(echo "$RESPONSE" | grep -oP '"total_entries"\s*:\s*\K[0-9]+' || echo "0")
  SECONDS_SINCE=$(echo "$RESPONSE" | grep -oP '"seconds_since_last"\s*:\s*\K[0-9]+' || echo "null")
fi

if [ "$TOTAL" -gt 0 ] 2>/dev/null && [ "$SECONDS_SINCE" != "null" ] && [ "$SECONDS_SINCE" -lt "$THRESHOLD" ] 2>/dev/null; then
  exit 0  # Recent flushed entry exists — allow edit
fi

# No recent entry or jot — block
echo "EMBRANCH: No recent diary entry or jot for ${ISSUE_ID}. Before editing, log what you are about to do using diary_jot(). Entry types: plan, work, observation, decision, learning." >&2
exit 2
