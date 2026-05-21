# Project Variables

| Variable         | Value           | Notes                                          |
| ---------------- | --------------- | ---------------------------------------------- |
| ProjectNamespace | TEST     | Default namespace for this project              |
| IssueID          | {ISSUE-ID}      | Current issue being worked on                  |
| Author           | {AUTHOR_EMAIL}  | Dolt user email (from `dolt config --global --get user.email`) |

## Agent Architecture

This project uses two specialized sub-agents for persistent memory:

### Dev Diary Agent (`psdd`)
- **Purpose:** Per-issue development diary â€” plans, work logs, bugs, challenges, learnings
- **Database:** Embranch MCP server (ChromaDB + Dolt via Python Embranch)
- **Collections:** `registry` (issue index), `dev-diary` (all entries)
- **Interface:** Structured assignments (see assignment types below)

### Knowledge Agent (`pskd`)
- **Purpose:** Cross-project tool/workflow knowledge base
- **Database:** Embranch MCP server (ChromaDB + Dolt via Python Embranch)
- **Collections:** `registry` (tool index), `filtered_learnings` (knowledge), `learnings` (inbox)
- **Interface:** Natural language queries

### Invocation Model (Hybrid â€” Option C)

**IMPORTANT:** The `/devdiary` and `/knowledge` Skill tools take over the entire response turn â€”
the main agent CANNOT continue implementation after a Skill call. To avoid blocking, use the
correct invocation method for each operation type:

| Operation | Invocation | Why |
|-----------|-----------|-----|
| **Reads/searches** (query diary, query knowledge) | Direct `mcp__psdd__*` / `mcp__pskd__*` calls | Non-blocking, no rules needed for reads |
| **Writes** (create diary entry, save learning) | `Agent` subagent (foreground) | Non-blocking, rules enforced via embedded prompt |
| **User-initiated** (user types `/devdiary` or `/knowledge`) | `Skill` tool | User expects the full skill experience |

**Never use the Skill tool for diary/knowledge operations during active implementation work.**
The Skill tool is only for when the user explicitly invokes `/devdiary` or `/knowledge`.

### Responsibility Boundary
| Concern | Who Handles |
|---------|-------------|
| Diary CRUD (dev-diary, registry) | Dev Diary Agent (psdd) via Agent subagent |
| Knowledge offload (filtered_learnings, registry) | Knowledge Offload Agent (pskd) via Agent subagent |
| Knowledge queries | Main Agent (you) via direct `mcp__pskd__*` calls |
| Version control (commit, branch, push/pull) | Main Agent (you) |
| Completion Gate (steps 9â€“11) | Main Agent (you) â€” triggers subagents as needed |

## Dev Diary Assignment Types

Use these structured commands when spawning the Dev Diary Agent:

### Search
~~~
ASSIGNMENT: Search
query: {search text}
max_tokens: 2000
~~~

### Get Details
~~~
ASSIGNMENT: Get Details
issue_id: {ISSUE-ID}
query: {optional search within issue}
entry_type: {optional: plan/work/bug/issue/challenge/learning/test/review}
~~~

### Create Registry Entry
~~~
ASSIGNMENT: Create Registry Entry
issue_id: {ISSUE-ID}
title: {title}
summary: {description}
related_issues: {comma-separated IDs}
~~~

### Create Diary Entry
~~~
ASSIGNMENT: Create Diary Entry
issue_id: {ISSUE-ID}
entry_type: {plan/work/bug/issue/challenge/learning/test/review}
content: {entry content}
~~~

### Get Learnings for Offload
~~~
ASSIGNMENT: Get Learnings for Offload
issue_id: {ISSUE-ID}
~~~

## Task Execution Flow

**MANDATORY**: When an `issueid` is provided, you MUST complete steps 1-4 below
BEFORE reading source code, writing plans, or making any changes.

### Before Starting Work (BLOCKING â€” complete before any implementation)
1. **Check Knowledge Agent** for relevant context (direct MCP â€” non-blocking):
   - `mcp__pskd__query_documents({ collection_name: "filtered_learnings", query_texts_json: "[\"topic\"]", n_results: 5 })`
   - `mcp__pskd__query_documents({ collection_name: "registry", query_texts_json: "[\"topic\"]", n_results: 3 })`
2. **Check Dev Diary** for previous work on this or related issues (direct MCP â€” non-blocking):
   - `mcp__psdd__query_documents({ collection_name: "dev-diary", query_texts_json: "[\"topic\"]", n_results: 10 })`
   - `mcp__psdd__query_documents({ collection_name: "registry", query_texts_json: "[\"IssueID\"]", n_results: 3 })`
3. **Create or verify registry entry** for current issue:
   - If no registry entry exists, the first diary entry via Agent subagent will auto-create one
4. **Log planned approach** (Agent subagent â€” non-blocking):
   - Use the `diary_write` Agent subagent pattern with `entry_type: plan`

**Step 4b â€” Pre-construct diary prompt templates** (recommended for long sessions):
   Before starting implementation, prepare the diary_write prompt template for each entry type
   you anticipate needing (at minimum: plan, work, learning). Store the full prompt text with
   the type-specific template, examples, and word budget injected. When invoking diary_write
   later, fill in ONLY the variable fields (content, title, metadata).
   Templates and examples: `AgentDocs/content-templates.md`.

### During Work
5. **Log significant work** at natural breakpoints:
   - Use `diary_write` Agent subagent with `entry_type: work`
6. **Log bugs discovered:**
   - Use `diary_write` Agent subagent with `entry_type: bug`
7. **Log challenges:**
   - Use `diary_write` Agent subagent with `entry_type: challenge`
8. **Log learnings immediately:**
   - Use `diary_write` Agent subagent with `entry_type: learning`

### Completion Gate (MANDATORY before ending task response)

When an `issueid` was provided and you've finished the implementation work, you MUST
complete the following before ending your response. Do NOT wait for the user to ask.

**Step 9 â€” Log final work summary** (always â€” highest priority entry):
   - This is the most important diary entry of the session. Use full template and examples.
   - Use `diary_write` Agent subagent with `entry_type: work`
   - Include: what was implemented, files changed, test results, checks passed
   - After the subagent writes, verify: query entry back, check scope/trigger/method populated.

**Step 10 â€” Commit dev diary** (always):
   - `mcp__psdd__dolt_commit({ message: "{IssueID}: {summary of diary entries}" })`

**Step 11 â€” Offer learning offload** (only if Knowledge Agent is available):
   - Check whether `mcp__pskd__*` tools are configured (try a quick read)
   - If unavailable: skip â€” the dev diary works independently
   - If available: check for diary learnings logged during this session:
     `mcp__psdd__query_documents({ collection_name: "dev-diary", query_texts_json: "[\"learning\"]", where_json: "{\"issue_id\": \"{IssueID}\", \"entry_type\": \"learning\"}", n_results: 10 })`
   - If learnings exist: tell the user how many and offer to offload
   - If the user confirms: use `knowledge_offload` Agent subagent pattern, then commit:
     `mcp__pskd__dolt_commit({ message: "Added raw learnings from {IssueID}" })`
   - If no learnings exist: reflect on the work â€” even straightforward tasks produce learnings.
     Log any identified insights, then re-query. Only skip if genuinely nothing.

**Step 12 â€” Offer learning processing** (only after Step 11 offload completes):
   - Ask: "Learnings are in the knowledge inbox. Shall I process them using `/knowledge`?"
   - If confirmed: invoke `/knowledge` Skill with command `process learnings`
   - If declined: skip â€” learnings remain in the inbox for later

**If the user asks to stop early**, complete at minimum steps 9â€“10.

## Diary Write Protocol (Agent Subagent)

When logging diary entries during active work, use the Agent tool with a `general-purpose`
subagent. This is non-blocking â€” the main agent continues after the subagent returns.

### `diary_write` Pattern

Agent(
  subagent_type="general-purpose",
  description="Log devdiary {entry_type} entry",
  prompt="""<role>You are the Dev Diary Sub-Agent â€” a concise technical log writer.
Be concise. Write compressed diary entries, not documentation.</role>

<tools>
Load MCP tools before any mcp__psdd__ calls:
  ToolSearch(query="+psdd add documents")
  ToolSearch(query="+psdd update documents")
  ToolSearch(query="+psdd query documents")
  ToolSearch(query="+psdd get documents")
  ToolSearch(query="+psdd dolt commit")
  ToolSearch(query="+psdd dolt status")
</tools>

<constraints>
- Target collections: diary entries â†’ "dev-diary", registry entries â†’ "registry"
- Document ID: {ISSUE_ID}-{entry_type}-{YYYYMMDD-HHmmss}-{6hex}
- DO NOT pre-chunk. Server handles chunking automatically.
- One learning per entry. If multiple learnings, create separate entries.
</constraints>

<length-constraint>
Be concise. At most {max_words} words. Each section: {max_bullets} bullets, each max 1 sentence.
If over budget, cut the least important bullet from the longest section.
</length-constraint>

<template type="{entry_type}">
{Insert ONLY the relevant template â€” see AgentDocs/content-templates.md}
</template>

<examples>
{Insert 2-3 examples for this entry type â€” see AgentDocs/content-templates.md}
</examples>

<metadata-requirements>
Required: issue_id, entry_type, date (YYYY-MM-DD), title, source_id (= doc ID),
  author: {AUTHOR_EMAIL}, created_at (ISO 8601), source_project: TEST,
  source_files (when applicable), schema_version: "2"
5W1H â€” populate scope, trigger, method on EVERY entry.
  OMIT decision_outcome/reasoning_summary for non-applicable types (do NOT set to "N/A"):
  decision_outcome (decision/investigation ONLY), reasoning_summary (decision/learning/gotcha ONLY)
</metadata-requirements>

<fact-priority>
When compressing, keep facts in priority order (cut from bottom first):
1. Files changed â€” exact paths with line numbers
2. Actions taken â€” specific function/component
3. Errors and root causes â€” exact messages in backticks
4. Decisions with rationale
5. Next steps and blockers
6. Discovery context (cut first)
</fact-priority>

<procedure>
1. Prepare content using template. Verify: template followed, metadata set, within budget.
2. Call add_documents to "dev-diary".
3. Update or create registry entry (get â†’ increment or create with entry_count: "1").
4. Branch-safe commit (check branch, commit if not main).
</procedure>

<critical-reminder>
Before submitting:
1. Content follows the {entry_type} template exactly â€” check section headings match
2. scope, trigger, and method metadata are all populated
3. Entry is at most {max_words} words â€” if over, cut the least important bullet
</critical-reminder>

ASSIGNMENT:
  issue_id: {ISSUE_ID}
  entry_type: {entry_type}
  title: {short title}
  content: {content}
"""
)

### `knowledge_offload` Pattern

Writes raw learnings to the `learnings` inbox in PSKD. Does NOT classify or deduplicate.

Agent(
  subagent_type="general-purpose",
  description="Offload learnings to PSKD inbox",
  prompt="""You are the Knowledge Offload Sub-Agent. Write raw learnings to the PSKD inbox.

FIRST â€” Load MCP tools (MANDATORY):
  ToolSearch(query="+pskd add documents")
  ToolSearch(query="+pskd get documents")

TARGET COLLECTION: "learnings" (the inbox)
Do NOT write to "filtered_learnings" or "registry"

DOCUMENT ID FORMAT:
  learning_{ISSUE_ID}_{YYYYMMDD}_{NNN}-{6hex}  (e.g., learning_EMBR-40_20260306_001-a3f8c2)
  Generate 6 random hex chars for collision resistance.

REQUIRED METADATA:
  - date, source_issue, tool, topic, provenance_diary_id, original_entry_type, offloaded_at
  - author: {AUTHOR_EMAIL}
  - source_project: TEST
  - source_files: (copy from original diary entry, if present)

ASSIGNMENT:
  source_issue: {ISSUE_ID}
  learnings: {numbered list}
"""
)

### When to Use Each Pattern

| Situation | Pattern |
|-----------|---------|
| Log plan, work, bug, challenge, learning | `diary_write` Agent subagent |
| Offload learnings to knowledge inbox (Step 11) | `knowledge_offload` Agent subagent |
| Process inbox into knowledge base (Step 12) | `/knowledge` Skill tool |
| Search diary/knowledge (reads) | Direct `mcp__psdd__*` / `mcp__pskd__*` calls |
| User explicitly types `/devdiary` or `/knowledge` | Skill tool |

## Version Control Rules
- **Commit diary entries** at the end of each work session or milestone
- **Commit knowledge changes** after processing offloaded learnings
- **Never commit from sub-agents** â€” only the main agent commits
- **Branch naming:** Follow project conventions (sub-agents don't create branches)

## Logging Rules
- All psdd operations are logged to `dev-diary-agent-log.txt` via hooks
- All pskd operations are logged to `prespective-knowledge-agent-log.txt` via hooks
- Hooks enforce metadata validation on `dev-diary` add_documents (require `issue_id`, `entry_type`, `author`, `created_at`)