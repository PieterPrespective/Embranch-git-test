#!/bin/bash
# Force a UTF-8 locale so `grep -P` (Perl regex) works under Git Bash on
# Windows. The default Windows codepage locale produces:
#   "grep: -P supports only unibyte and UTF-8 locales"
# which silently empties the JSON-extraction pipelines below.
export LC_ALL=C.UTF-8

# Embranch: Remind to log outcome after git commits — advisory only
# PostToolUse hook for Bash — reminds agent to log outcome entry after commits.
# Exit 0 always (advisory, never blocks).
#
# Environment variables:
#   EMBRANCH_HOOKS_DISABLED=1  — skip all Embranch hooks

# Skip if hooks disabled
if [ "${EMBRANCH_HOOKS_DISABLED:-0}" = "1" ]; then exit 0; fi

# Read tool result from stdin
INPUT=$(cat)

# Check if the command was a git commit
COMMAND=""
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  # Fallback: search for git commit in the raw JSON
  COMMAND=$(echo "$INPUT" | grep -oP '"command"\s*:\s*"\K[^"]*' | head -1)
fi

if echo "$COMMAND" | grep -q 'git commit'; then
  HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  echo "embranch: committed $HASH — consider logging an outcome entry"
fi
exit 0
