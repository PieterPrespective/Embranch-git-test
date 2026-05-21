#!/bin/bash
# Force a UTF-8 locale so `grep -P` (Perl regex) works under Git Bash on
# Windows. The default Windows codepage locale produces:
#   "grep: -P supports only unibyte and UTF-8 locales"
# which silently empties the JSON-extraction pipelines below.
export LC_ALL=C.UTF-8

# Embranch: Suggest diary entry after errors — advisory only
# PostToolUse hook for Bash — reminds agent to log observation/pivot on failure.
# Exit 0 always (advisory, never blocks).
#
# Environment variables:
#   EMBRANCH_HOOKS_DISABLED=1  — skip all Embranch hooks

# Skip if hooks disabled
if [ "${EMBRANCH_HOOKS_DISABLED:-0}" = "1" ]; then exit 0; fi

# Read tool result from stdin
INPUT=$(cat)

# Extract exit code from tool result JSON
# Claude Code PostToolUse sends: { "tool_name": "Bash", "tool_input": {...}, "tool_result": { "exitCode": N } }
if command -v jq &>/dev/null; then
  EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exitCode // .tool_result.exit_code // empty' 2>/dev/null)
else
  EXIT_CODE=$(echo "$INPUT" | grep -oP '"exitCode"\s*:\s*\K[0-9]+' | head -1)
  if [ -z "$EXIT_CODE" ]; then
    EXIT_CODE=$(echo "$INPUT" | grep -oP '"exit_code"\s*:\s*\K[0-9]+' | head -1)
  fi
fi

if [ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" != "0" ]; then
  echo "embranch: command failed (exit $EXIT_CODE) — consider logging an observation or pivot entry"
fi
exit 0
