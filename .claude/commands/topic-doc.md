---
description: Generate comprehensive documentation for a codebase topic using code analysis, version history, and knowledge bases
argument-hint: <natural language prompt describing what you want to know>
context: fork
agent: topic-doc-agent
---

# Topic Documentation Generator

Generate documentation for a topic within a codebase. Describe what you want in natural language — the agent will infer the topic, mode, date range, and output path from your prompt.

## Examples
- `/topic-doc how does authentication work in this project`
- `/topic-doc show me the history of the shopping cart since January`
- `/topic-doc everything about the report generator — what it does and how it evolved`
- `/topic-doc what changes were made to the VCS components last quarter`
- `/topic-doc document the current state of Application.cfc`

## Post-completion

After the agent returns, log to dev diary if an IssueID is active:
`/devdiary ASSIGNMENT: Create Diary Entry\nissue_id: {IssueID}\nentry_type: work\ncontent: Generated topic-doc for "{topic}" ({mode} mode). Output: {path}`

$ARGUMENTS
