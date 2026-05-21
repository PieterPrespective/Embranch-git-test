# Issue Log: diary_jot Tool Not Found

**Date:** 2026-05-21
**Session:** TEST-A-01 / s-20260521-093534-60186a
**Severity:** Low (workaround found immediately)

## Problem

The Embranch workflow rules (`.claude/rules/embranch-workflow.md`) reference `diary_jot()` as the MCP tool for logging entries during active work:

> | Log a diary entry during work | `diary_jot()` MCP tool (lightweight, buffered) |

The `diary_jot` name appears throughout the workflow document — in the "During Work" triggers table, field reference table, entry ID tracking section, and session-end steps. However, no MCP tool with that name exists in the deferred tool registry.

## Discovery

After logging the plan entry (Step 3) via the diary-writer subagent, I attempted to load `diary_jot` to log the work results:

1. **`ToolSearch(query="select:mcp__psdd__diary_jot")`** — returned "No matching deferred tools found". The `select:` prefix does exact name matching, confirming no tool with that name is registered.

2. **`ToolSearch(query="psdd diary jot")`** — keyword search across all psdd tools. Returned 5 results, none of which were a jot/write tool:
   - `mcp__psdd__adopt_orphan_jot` — claims an orphaned HumanDocument row
   - `mcp__psdd__discard_orphan_jot` — discards an orphaned row
   - `mcp__psdd__start_session` — already loaded
   - `mcp__psdd__add_documents` — raw document insertion (no field validation)
   - `mcp__psdd__bootstrap_repository` — repo setup

3. **`ToolSearch(query="psdd jot")`** — same results, no direct match.

## Resolution

I had already loaded `mcp__psdd__create_entry` earlier in the session (before the plan subagent step). Reviewing its description:

> "Create a diary entry in HumanDocuments with required-field enforcement. Returns immediately with a human_id."

This tool matches the behavior described for `diary_jot()` in the workflow rules:
- Creates entries in HumanDocuments (the jot/buffered layer)
- Accepts `entry_type`, `session_token`, `issue_id`, `title`, `content`, and all the type-specific fields referenced in the workflow (e.g., `decision_outcome`, `reasoning_summary`, `outcome_status`, `parent_human_id`)
- Returns immediately with an ID (lightweight/buffered)
- Entries are flushed later via `flush_session()`

I used `mcp__psdd__create_entry` for all three jot entries (2x `work`, 1x `outcome`), and all succeeded with status `unprocessed`. The subsequent `flush_session()` processed all 3 entries correctly.

## Root Cause

The workflow documentation uses the name `diary_jot()` but the actual MCP tool is registered as `mcp__psdd__create_entry`. This is a naming discrepancy between the harness documentation and the MCP server's tool registry. The tool likely was renamed or refactored at some point, and the workflow rules were not updated to reflect the new name.

## Impact

- No data loss or functional impact — the correct tool was already loaded from an earlier step.
- ~2 extra ToolSearch round-trips spent discovering the tool didn't exist under the documented name.
- If `create_entry` had not been pre-loaded, resolution would have required broader keyword searching or trial-and-error against the tool registry.

## Recommendation

Update `.claude/rules/embranch-workflow.md` to replace references to `diary_jot()` with `create_entry()` (or add an alias note) so future sessions don't hit the same lookup failure.
