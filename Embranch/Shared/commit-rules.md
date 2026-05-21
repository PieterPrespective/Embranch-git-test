# Branch-Safe Commit Rules

**Canonical reference for Dolt commit rules across all agents.**

## Core Rule: Agents MAY Commit, but NEVER on Main

Before committing, every agent MUST check the current branch:

1. Call `dolt_status` or `dolt_branches` to determine the active branch
2. **If active branch is `main`**: DO NOT COMMIT. Report:
   > "Cannot commit on main branch. Please switch to a work branch first
   > (e.g., `dolt_checkout -b work/{issue_id}`)."
3. **If active branch is NOT `main`**: Proceed with commit

## Who Commits What

| Agent | Database | Commits? | Condition |
|-------|----------|----------|-----------|
| diary-writer | PSDD | **YES** | Not on main |
| knowledge-offloader | PSKD | **NO** | Main agent commits after offload |
| knowledge (process learnings) | PSKD | **YES** | Not on main |
| dev-diary (interactive `/devdiary`) | PSDD | **YES** | Not on main |
| Main agent | PSDD / PSKD | **YES** | Always (owns version control) |

## Commit Message Formats

| Operation | Message Format |
|-----------|---------------|
| Diary entry (by diary-writer) | `{IssueID}: {entry_type} - {title}` |
| Diary commit (by main agent, Step 10) | `{IssueID}: {summary of diary entries}` |
| Knowledge offload (by main agent, Step 11) | `Added raw learnings from {IssueID}` |
| Knowledge processing (by knowledge agent) | `Processed learnings from {IssueID}` |

## Handling NOTHING_TO_COMMIT

If a commit returns `NOTHING_TO_COMMIT`, this is OK — it means a sub-agent already
committed the changes. Do not treat this as an error.

## Branch Naming Conventions

| Purpose | Pattern | Example |
|---------|---------|---------|
| Work branch | `work/{issue_id}` | `work/EMBR-97` |
| Feature branch | `feature/{description}` | `feature/sync-engine` |

Sub-agents **NEVER** create or delete branches. Only the main agent or the user manages branches.

## Push / Pull Rules

- Sub-agents **NEVER** push or pull
- Only the main agent pushes/pulls, and only when explicitly requested by the user
