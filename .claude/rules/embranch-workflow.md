# Embranch Workflow Rules

> **EMBR-364 Phase 7 — unified MCP entry.** All `mcp__embranch__*` calls below require an additional `knowledge_base` argument: `"psdd"` for dev-diary operations (the agent_memory KB) or `"pskd"` for knowledge-base operations (the domain_knowledge KB). The previous dual-server scheme — one MCP entry per kb_type — was retired in favour of a single entry that hosts both KBs as named siblings under `./data/`.


## Rule Precedence
Project rules (CLAUDE.md, other .claude/rules/) override Embranch rules.
Embranch rules govern diary logging and knowledge management only.
Diary operations write to PSDD (Dolt), not to git.

## Project Variables
| Variable         | Value       |
| ---------------- | ----------- |
| ProjectNamespace | {NAMESPACE} |
| IssueID          | {ISSUE-ID}  |

## Invocation Rules
| Operation | Method |
|-----------|--------|
| Read/search diary or knowledge | Direct `mcp__embranch__*` (with `knowledge_base="psdd"` or `"pskd"`) calls |
| Log a diary entry during work | `diary_jot()` MCP tool (lightweight, buffered) |
| Flush buffered entries to diary | `flush_session()` MCP tool (at session end) |
| Plan or learning entry (needs structure) | Agent subagent — see AgentDocs/diary-writer-slim.md |
| Extract decisions from git/files/dirs | `/extract-decisions` skill OR Agent subagent — see AgentDocs/decision-extractor-slim.md |
| User invokes `/devdiary` or `/knowledge` | Skill tool |

NEVER use `/devdiary`, `/knowledge`, or `/extract-decisions` skills during active work — they block the turn.

## Session Start (Steps 0-3 — BLOCKING before implementation)

**Step 0** — `start_session(collection_name="dev-diary", issue_id="{IssueID}")`
  Store `session_token`. Set env vars:
  `export EMBRANCH_ISSUE_ID="{IssueID}"`
  `export EMBRANCH_DATA_PATH="{data_path}"`
  If `prior_sessions == 0` AND knowledge DB is empty: skip Steps 1-2.

**Step 1** — Query knowledge (direct MCP):
  `mcp__embranch__QueryDocuments(collectionName="filtered_learnings", queryTextsJson="[\"topic\"]", nResults=5)`

**Step 2** — Query dev diary for prior work (direct MCP):
  `mcp__embranch__QueryDocuments(collectionName="dev-diary", queryTextsJson="[\"topic\"]", nResults=5)`

**Step 3** — Log plan via Agent subagent (FOREGROUND, see AgentDocs/diary-writer-slim.md)
  Only for plan and learning entries. All other entries use diary_jot().

## Plan Mode
Hooks on EnterPlanMode/ExitPlanMode enforce session recovery. See `.claude/hooks/embranch-plan-mode-guard.js`.

## During Work — Behavioral Triggers

Use `diary_jot()` for all of these. Include the specific fact, not just the category.

| Trigger | entry_type | What to Capture |
|---------|-----------|-----------------|
| Multiple viable approaches | option_eval | Options, trade-offs, chosen, rationale |
| About to make a code change | work | What, which files, why |
| A command/test fails | observation | What failed, error message, implication |
| Something unexpected found | observation | Finding, context, implications |
| Changing strategy | pivot | Old approach, why failed, new approach |
| Deliberate non-obvious choice | decision | What chosen, why, what rejected |
| Bug found | bug | Symptom, root cause, fix |
| Harder than expected | challenge | What was hard, how resolved |
| Insight gained | learning | Insight, evidence, how to apply |
| Surprising non-obvious fix | gotcha | Problem, root cause, fix |
| A fix addresses an external root cause | learning | Constraint, origin, when it recurs |

After any fix, ask: "Is the root cause in my code, or in something external (data source,
tool, API, library default, environment)?" External root causes are project learnings
regardless of fix difficulty — your training data is not the project's knowledge base.

For **learning** jots: include a concrete example after `---example---` delimiter.
Format: `Wrong: [incorrect approach]\nRight: [correct approach]` (max 80 tokens).
Skip examples for design decisions and process patterns.

Do NOT log: file reads, git status, obvious internal choices, successful expected operations.

### diary_jot Field Reference

When calling `diary_jot()`, include these type-specific fields beyond the basics:

| Entry Type | Extra Fields to Include | Example |
|-----------|------------------------|---------|
| option_eval | `decision_outcome`, `reasoning_summary`, `parent_entry_id`, `confidence` | `decision_outcome: "NodeVisitor"`, `reasoning_summary: "..."`, `confidence: "High"` |
| decision | `decision_outcome`, `reasoning_summary`, `parent_entry_id`, `confidence` | `decision_outcome: "exclude-modules"` |
| learning | `confidence`, `parent_entry_id`, `extra_metadata: {"approach_context": "...", "applicability_scope": "..."}` | `confidence: "Medium"` |
| observation | `parent_entry_id`, `extra_metadata: {"observation_category": "behavior", "affects_current_task": "true"}` | |
| outcome | `parent_entry_id`, `extra_metadata: {"outcome_status": "success"}` | |
| work | `parent_entry_id` | |
| All others | `parent_entry_id` (if chain_state has a parent) | |

The server validates required fields and returns errors for missing ones.
Do NOT omit `decision_outcome` on option_eval/decision — the jot will be rejected.

### Entry ID Tracking (Jot Model)

Jot document IDs are generated at flush time, not jot time. For reasoning chains:

1. **Plan entry** (via subagent): Extract `document_id` from subagent response. Store as `plan_id`.
2. **All subsequent jots**: Set `parent_entry_id = plan_id`.
3. **After flush**: Flush response includes `document_ids`. No chain_state update needed.

Mid-session chain references always point to the plan entry. This gives 100% chain
coverage. Exact jot-to-jot links are not possible until after flush.

## Session End — Completion Gate (MANDATORY)

**Step 4** — Log final work summary (FOREGROUND):
  Use `diary_jot()` with `entry_type: work`. Focus on verification evidence, not
  implementation narrative. Max 250 words for completion-gate work entries.
  If verification is extensive (>3 test results), split into:
  - `work` entry: what was implemented, key files, summary metrics
  - `outcome` entry: test results, verification evidence, pass/fail status
  Do NOT include: acceptance criteria checklists, diary discipline narrative,
  re-statement of the plan approach (already logged).
**Step 5** — Flush and commit:
  Call `flush_session(issue_id, session_token)` — writes all buffered jots AND updates registry.
  Call `mcp__embranch__DoltCommit({message: "{IssueID}: {summary}"})`.
  NOTHING_TO_COMMIT is acceptable (flush may have already committed).
**Step 7** — Query learning-type jots from flush response `learning_ids`.
  If learnings exist AND interactive mode: spawn knowledge_offload Agent subagent
  (see AgentDocs/knowledge-offload-slim.md).
**Step 8** — **MANDATORY in autonomous mode** — process learnings with dedup:
  If `learning_ids` is non-empty, for each learning:

  8a. Retrieve entry:
     `mcp__embranch__GetDocuments(collection_name="dev-diary", ids=["{learning_id}"])`

  8b. **Dedup check** — search for similar existing learnings:
     `mcp__embranch__QueryDocuments(collectionName="filtered_learnings",
       queryTextsJson="[\"learning content summary\"]", nResults=3)`
     - Distance < 0.5 + same approach_context → SKIP (duplicate)
     - Distance < 0.5 + different approach_context → KEEP (approach variant)
     - Contradicts existing → UPDATE existing with new evidence via UpdateDocuments
     - Distance >= 0.5 → NEW, proceed to write

  8c. **Tool/topic identification** — match to registry:
     Extract tool from scope. Search: `mcp__embranch__QueryDocuments(collectionName="registry",
       queryTextsJson="[\"tool\"]", nResults=1)`
     Use matched `tool_name`, or derive slug from scope if no match.

  8d. **Write** to filtered_learnings:
     `mcp__embranch__AddDocuments(collectionName="filtered_learnings", documentsJson="[{...}]",
       idsJson="[\"fl_{learning_id}\"]", metadatasJson="[{\"source_issue\":\"{IssueID}\",
       \"provenance_diary_id\":\"{learning_id}\", \"confidence\":\"medium\",
       \"approach_context\":\"...\", \"applicability_scope\":\"...\",
       \"learning_level\":\"L3\", \"tool\":\"...\", \"topic\":\"...\",
       \"topics\":\"tag1,tag2,tag3\"}]")`
     Use confidence/approach_context/applicability_scope/learning_level from diary entry
     metadata when available; fall back to defaults shown above.

  8e. **Update registry** counts for each tool:
     `mcp__embranch__UpdateDocuments(collection_name="registry", ids=["{tool_id}"],
       metadatas=[{"learning_count": "{new_count}", "last_updated": "{ISO}"}])`

  8f. **Commit**: `mcp__embranch__DoltCommit(message="Learnings from {IssueID}")`

  Do NOT skip this step. Do NOT "offer" processing to the user.
  Unprocessed learnings are invisible to future runs.

## Registry Management

Registry entries are managed automatically by `flush_session()`. When jots are flushed,
the server creates or updates the registry entry with the correct `entry_count`, `title`,
and timestamps. No manual registry management is needed.

## Hook Configuration

### Pre-Edit Enforcement
The `require-diary-entry` hook blocks `Edit`/`Write` unless a recent diary entry or jot
exists (within 20 minutes). If blocked: use `diary_jot()` to log what you're about to do.

### Post-Error / Post-Commit
Non-blocking advisories suggesting observation/outcome entries. Not enforced.

### Disabling Hooks
Set `EMBRANCH_HOOKS_DISABLED=1` to skip all Embranch hooks.

## Version Control Rules

- **NEVER commit on `main`** — check via DoltStatus() first.
- Diary: committed at flush (Step 5).
- If on main: prompt user to switch branch.
