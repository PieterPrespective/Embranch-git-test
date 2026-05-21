# Assignment Formats

**Canonical reference for diary-writer and knowledge-offloader invocation formats.**

All harnesses use the same logical assignments but differ in invocation syntax. This
document defines the canonical field set for each assignment type; the Claude Code
syntax below is the canonical invocation, and other harnesses adapt via their native
subagent/skill mechanism.

---

## Diary Writer — Create Diary Entry

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `issue_id` | string | Issue being worked on (e.g., `EMBR-97`) |
| `entry_type` | string | plan / work / bug / issue / challenge / learning / test / review |
| `author` | string | Dolt user email |
| `source_project` | string | Project namespace (e.g., `EMBRPY`) |
| `created_at` | string | Current ISO 8601 timestamp (e.g., `2026-03-11T14:30:25Z`) |
| `title` | string | Short summary |
| `content` | string | Full entry content |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `source_files` | string | Comma-separated `path:line` refs for relevant code |

### Claude Code Syntax (Agent subagent)

The main agent constructs the diary_write prompt by injecting ONLY the relevant entry type's
template, examples, and word budget (see `content-templates.md`). Do NOT include all 8 templates.

```python
Agent(
  subagent_type="general-purpose",
  description="Log devdiary work entry",
  prompt="""<role>You are the Dev Diary Sub-Agent — a concise technical log writer.
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
- Target collections: diary entries → "dev-diary", registry entries → "registry"
- Document ID: {ISSUE_ID}-{entry_type}-{YYYYMMDD-HHmmss}-{6hex}
- DO NOT pre-chunk. Server handles chunking automatically.
- One learning per entry. If multiple learnings, create separate entries.
</constraints>

<length-constraint>
Be concise. At most {max_words} words. Each section: {max_bullets} bullets, each max 1 sentence.
</length-constraint>

<template type="{entry_type}">
{Insert ONLY the relevant template — see content-templates.md}
</template>

<examples>
{Insert 2-3 examples for this entry type — see content-templates.md}
</examples>

<metadata-requirements>
Required: issue_id, entry_type, date, title, source_id, author, created_at, source_project
5W1H (populate on every entry): scope, trigger, method
  (See AgentWorkflow/Shared/metadata-schemas.md)
</metadata-requirements>

<procedure>
1. Prepare content using template. Verify: template followed, metadata set, within budget.
2. Call mcp__psdd__add_documents to "dev-diary".
3. Update or create registry entry.
4. Branch-safe commit (see AgentWorkflow/Shared/commit-rules.md).
</procedure>

<critical-reminder>
Before submitting:
1. Content follows the {entry_type} template exactly — check section headings match
2. scope, trigger, and method metadata are all populated
3. Entry is at most {max_words} words — if over, cut the least important bullet
</critical-reminder>

ASSIGNMENT:
  issue_id: EMBR-97
  entry_type: work
  created_at: 2026-03-11T14:30:25Z
  title: Implemented sync engine
  content: Full content of the entry...
"""
)
```

---

## Knowledge Offloader — Offload Learnings to Inbox

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `source_issue` | string | Originating issue ID |
| `author` | string | Dolt user email |
| `source_project` | string | Project namespace |
| `provenance_diary_ids` | list | Diary entry IDs these learnings came from |
| `learnings` | list | Numbered list with content, tool, and topic per learning |

### Learning Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | The learning text |
| `tool` | string | Tool name or `"unknown"` |
| `topic` | string | kebab-case topic slug |

### Claude Code Syntax (Agent subagent)

```python
Agent(
  subagent_type="general-purpose",
  description="Offload learnings to PSKD inbox",
  prompt="""You are the Knowledge Offload Sub-Agent. Write raw learnings to the PSKD
learnings inbox for later processing.

FIRST — Load MCP tools (MANDATORY before any mcp__pskd__ calls):
  ToolSearch(query="+pskd add documents")
  ToolSearch(query="+pskd get documents")

TARGET COLLECTION:
- Write ALL learnings to: "learnings" (the inbox)
- Do NOT write to "filtered_learnings" or "registry"

DOCUMENT ID FORMAT:
  learning_{ISSUE_ID}_{YYYYMMDD}_{NNN}-{6hex}
  (See AgentWorkflow/Shared/id-format.md)

REQUIRED METADATA: date, source_issue, tool, topic, provenance_diary_id,
  original_entry_type, offloaded_at, author, source_project
  (See AgentWorkflow/Shared/metadata-schemas.md)

DO NOT: classify confidence, check duplicates, update registry, write to filtered_learnings

ASSIGNMENT:
  source_issue: EMBR-97
  author: pieter@prespective.com
  source_project: EMBRPY
  provenance_diary_ids: [EMBR-97-learning-20260311-143025-a3f8c2]
  learnings:
    1. content: ChromaDB requires $and for multi-field where filters
       tool: chromadb
       topic: chromadb-where-and-operator
"""
)
```
