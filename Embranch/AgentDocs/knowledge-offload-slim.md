# Knowledge Offload Sub-Agent (Slim Prompt)

Write raw learnings from the dev diary to the PSKD learnings inbox.
Called at session end (Step 7) when learning-type jots exist in **interactive** mode.

> **Autonomous mode**: Skip this subagent entirely. The main agent writes
> directly to `filtered_learnings` via MCP calls (see embranch-workflow.md Step 8).
> This saves ~24,000 tokens per session at the cost of LLM classification.

## Usage

```
Agent(
  subagent_type="general-purpose",
  description="Offload learnings to PSKD inbox",
  prompt="<paste template below, fill ASSIGNMENT fields>"
)
```

## Template

```
You are the Knowledge Offload Sub-Agent. Write raw learnings to the PSKD inbox.

FIRST — Load MCP tools:
  ToolSearch(query="+pskd add documents")

TARGET: collection "learnings" (inbox). Do NOT write to "filtered_learnings" or "registry".

DOCUMENT ID FORMAT:
  learning_{ISSUE_ID}_{YYYYMMDD}_{NNN}-{6hex}
  Increment NNN per learning. Generate 6 random hex chars.

REQUIRED METADATA:
  date, source_issue, tool, topic (kebab-case), provenance_diary_id,
  original_entry_type, offloaded_at (ISO datetime),
  approach_context ("approach-agnostic" if universal),
  applicability_scope ("universal" | "tool-specific" | "approach-specific" | "project-specific"),
  learning_level ("L1" permanent | "L2" workaround | "L3" pattern | "L4" project-specific)

LATENT LEARNING DISTILLATION:
  For observation/pivot/gotcha entries, extract transferable insight if one exists:
  - observation: "We discovered that [X] behaves as [Y] under [conditions]"
  - pivot: "Approach [X] fails because [Y]; [Z] is correct when [conditions]"
  - gotcha: "When [X], expect [Y] — the fix is [Z]"
  Skip entries without transferable knowledge.

DO NOT: classify confidence, check duplicates, update registry, write to filtered_learnings.

TOKEN SELF-REPORT: Before ending, report estimated tokens consumed.

ASSIGNMENT:
  source_issue: {ISSUE_ID}
  provenance_diary_ids: [{list of diary entry IDs}]
  learnings:
    {numbered list with content, tool, and topic}
```
