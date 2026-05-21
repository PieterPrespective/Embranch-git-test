# Extract Decisions

Extract decisions from git history, files, or directories and prepare them for import into Embranch.

## Usage
```
/extract-decisions <natural language description of what to extract>
```

## Examples
- `/extract-decisions` — extract from current repo, last 100 commits
- `/extract-decisions from the last 50 commits`
- `/extract-decisions from E:\OtherProject branch feat/auth`
- `/extract-decisions from meeting-notes.md`
- `/extract-decisions from docs/architecture/`
- `/extract-decisions from CHANGELOG.md and import to EMBR-300`
- `/extract-decisions from last 100 commits about infrastructure`

---

You are the **Decision Extraction Orchestrator**. Parse the user's request,
coordinate extraction (parallel for git, single-agent for files/directories),
then curate and present the results.

## Step 1: Parse Arguments

Parse `$ARGUMENTS` into a source type and extraction parameters using these rules:

### Source Detection
1. If the argument names a **file** (path ends in a file extension, or file exists): `source_type = "file"`
2. If the argument names a **directory** (path ends in `/`, or directory exists without `.git/`): `source_type = "directory"`
3. If the argument mentions **commits**, **branch**, **repo**, or names a **git repo** (has `.git/`): `source_type = "git"`
4. If no source specified: `source_type = "git"`, `repo_path = "."` (default)

To disambiguate paths, check existence:
- `Bash: test -f "<path>" && echo file || (test -d "<path>/.git" && echo git || (test -d "<path>" && echo dir || echo notfound))`

### Parameter Extraction

**Git parameters:**
| Pattern | Parameter |
|---------|-----------|
| "last N commits" / "N commits" | `max_commits: N` |
| "from PATH" (git repo) | `repo_path: PATH` |
| "branch X" / "on branch X" | `branch: X` |
| "since DATE" | `commit_range` (compute from date) |
| "X..Y" / "between X and Y" | `commit_range: "X..Y"` |

**File parameters:**
| Pattern | Parameter |
|---------|-----------|
| "from PATH" (file) | `file_path: PATH` |

**Directory parameters:**
| Pattern | Parameter |
|---------|-----------|
| "from PATH" (directory) | `dir_path: PATH` |
| "only PATTERN" / "only *.md" | `file_filter: PATTERN` |

**Filtering parameters:**
| Pattern | Parameter |
|---------|-----------|
| "exclude .ext1 .ext2" | `exclude_extensions: [".ext1", ".ext2"]` |
| "strip-lines pat1 pat2" | `strip_line_patterns: ["pat1", "pat2"]` |
| "signals-only" | `diff_mode: "decision_signals"` |

**Common parameters:**
| Pattern | Parameter |
|---------|-----------|
| "about TOPIC" / "focus on TOPIC" | `focus: TOPIC` |
| "and import to ISSUE-ID" | `auto_import: true, issue_id: ISSUE-ID` |

---

## Step 2: Route by Source Type

### IF source_type == "file" or "directory":
Use the single-agent path. Spawn one sub-agent using the template in
`Embranch/AgentDocs/decision-extractor-slim.md`.
Skip to **Step 6: Present Results**.

### IF source_type == "git":
Continue to **Step 3: Git Extraction (Parallel)**.

---

## Step 3: Git Discovery

Load the extract_decisions tool:
```
ToolSearch(query="extract decisions")
```

Call it to get total commit count:
```
extract_decisions(repo_path, max_commits, branch, commit_range,
  include_diffs=false, offset=0, limit=1)
```

Note `total_count`, `file_type_summary`, `total_file_changes`, and
`unique_files` from response.

---

## Step 3.5: Scope Check

**IF `exclude_extensions` or `strip_line_patterns` were provided in Step 1:**
Skip this step — the user already specified their filtering.

**IF `total_file_changes` ≤ 500 AND no single extension accounts for > 20%
of changes:**
Skip this step — scope is manageable without filtering.

**OTHERWISE** — present the scope breakdown to the user:

Read `file_type_summary` from the Step 3 response. Calculate percentages
from `total_file_changes`. Display the top 10 file types:

```
Scanning {total_count} commits — {total_file_changes} file changes across
{unique_files} unique files.

  {ext}    {count}  ({pct}%)
  ...      ...      ...

No exclusions set. All file types will be included in diff analysis.

You can narrow the scope:
  - "exclude .meta .asset .unity"    — skip diffs for these file types
  - "strip-lines guid: m_FileID:"   — remove matching lines from all diffs
  - "signals-only"                   — keep only decision-relevant diff lines
                                       (comments, docs, configs, keywords)
  - "proceed"                        — extract everything as-is
```

**WAIT** for user response. Parse their reply:
- "proceed" / "go" / "yes" → continue with no filtering
- "exclude ..." → set `exclude_extensions`, continue
- "strip-lines ..." → set `strip_line_patterns`, continue
- Both in one reply → set both, continue

---

## Step 4: Resume Check

Check for existing checkpoint files:
```
Bash: ls "<repo_path>/.embranch/extraction-checkpoints/checkpoint-"*.json 2>/dev/null | head -50
```

**If checkpoint files exist:**
- Read each file to check `"completed": true`
- Count completed vs total expected batches
- Tell the user: "Found N/M batches already completed from a prior run."
- Ask: "Resume from where it stopped, or restart fresh?"
- If restart: `Bash: rm -rf "<repo_path>/.embranch/extraction-checkpoints/"`

**If no checkpoints:** proceed to Step 5.

---

## Step 5: Parallel Extraction

Create the checkpoint directory:
```
Bash: mkdir -p "<repo_path>/.embranch/extraction-checkpoints"
```

### Plan batches:
```
batch_size = 10
total_batches = ceil(total_count / batch_size)
```

For each batch, compute:
- `offset`: batch_index × batch_size
- `limit`: batch_size
- `batch_id`: zero-padded offset (e.g., "000", "010", "020")
- `checkpoint_path`: `<repo_path>/.embranch/extraction-checkpoints/checkpoint-<batch_id>.json`

Skip batches that already have completed checkpoint files (from resume).

### Small repo shortcut (≤ 20 commits):
If total_count ≤ 20, spawn a single extraction agent for the entire repo
instead of parallelizing. Use the template from
`Embranch/AgentDocs/decision-batch-extractor.md` with
offset=0 and limit=total_count.

### Parallel dispatch:
Spawn up to **5 extraction agents per round**. Each agent uses the template
from `Embranch/AgentDocs/decision-batch-extractor.md`.

When filling the template, include the filtering parameters from Step 1 /
Step 3.5 in each agent's ASSIGNMENT block:
- `exclude_extensions`: the list from Step 1 or Step 3.5, or `"none"`
- `strip_line_patterns`: the list from Step 1 or Step 3.5, or `"none"`
- `diff_mode`: from Step 1 or Step 3.5, default `"changes_only"`

```python
# Round 1: spawn up to 5 agents in a SINGLE message (parallel)
Agent(
    subagent_type="general-purpose",
    description="Extract batch 000",
    prompt="<filled decision-batch-extractor.md with offset=0, limit=10, batch_id=000,
             exclude_extensions=..., strip_line_patterns=...>"
)
Agent(
    subagent_type="general-purpose",
    description="Extract batch 010",
    prompt="<filled decision-batch-extractor.md with offset=10, limit=10, batch_id=010,
             exclude_extensions=..., strip_line_patterns=...>"
)
# ... up to 5 agents
```

**Wait for all agents in the round to complete**, then spawn the next round.
Continue until all batches are dispatched.

### Efficiency check:
Batch agents should only use allowed tools (ToolSearch, extract_decisions,
get_batch_diff, Write). If an agent's TOKEN SELF-REPORT shows use of
Read, Grep, Glob, or Bash, note this in the final summary as a warning.

---

## Step 6: Collect & Curate

### 6.0 Collect checkpoint files:
Read all checkpoint files from `.embranch/extraction-checkpoints/`:
```
Glob: <repo_path>/.embranch/extraction-checkpoints/checkpoint-*.json
```

Read each file. Combine all `candidates` arrays into a single list.

### 6.0.1 Verify completeness:
Check that every expected batch has a completed checkpoint. If any are
missing, report which batches failed and offer to re-run them.

### 6.1 MERGE — Combine Related Candidates

**Trigger:** Two or more candidates match ANY of these criteria:
- Same `decision_topic` (exact match)
- Overlapping `source_ref` values (same commit across batches)
- Titles with > 80% word overlap (ignore stop words: the, a, for, of, in, to)
- Same `source_ref` AND similar `decision_text` (same commit, same concept)

**Rules:**
- Combined candidate gets `source_ref` as a list of all contributing refs
- `title`: use the most descriptive title from the group
- `decision_text`: synthesize from all contributing texts (union of information)
- `reasoning_evidence`: concatenate all evidence, deduplicate identical lines
- `alternatives_evidence`: concatenate all evidence, deduplicate
- `confidence`: highest confidence from the group
- `contributing_strategies`: union of all strategies
- `scope`: most specific scope (longest path wins)
- `_curation_action`: "merged"

**DEDUP pass:** After all merges, scan for remaining pairs with identical
titles. These are cross-batch duplicates where `decision_topic` strings
diverged. Merge them.

**Example:**
```
Input:
  A: {topic: "infra/database-engine", title: "Switch to PostgreSQL",
      decision_text: "Replace SQLite", source_ref: "abc123"}
  B: {topic: "infra/database-engine", title: "PostgreSQL migration",
      decision_text: "Migrate data layer to PostgreSQL", source_ref: "def456"}

Output:
  {topic: "infra/database-engine", title: "Switch to PostgreSQL",
   decision_text: "Replace SQLite with PostgreSQL for the data layer",
   source_ref: ["abc123", "def456"],
   confidence: max(A.confidence, B.confidence),
   _curation_action: "merged"}
```

### 6.1.5 ABSORB — Fold Sub-Decisions into Parents

**Trigger:** A candidate describes a consequence, configuration detail,
or implementation-level aspect of another candidate already in the list.

**Detection — ABSORB candidate B into candidate A if:**
- B's scope is a child of A's scope
  (e.g., B: "backup/trigger" is child of A: "backup/strategy")
- OR B's `decision_text` references the same concept as A but at a
  lower level of abstraction (detail vs. strategy)
- OR B's `files_changed` is a subset of A's

**Action:**
- Add B's `decision_text` as a bullet under A's `context` field
- Add B's `reasoning_evidence` to A's (if present and distinct)
- Remove B from the candidate list
- Set A's `_curation_action` to "absorbed"

**Examples of sub-decisions to absorb:**
- "Auto-detect TTY for color" → absorb into "ANSI codes over colorama"
- "Create backups before destructive ops" → absorb into "Rotating backup strategy"
- "Apply migrations on load" → absorb into "Forward-only migrations"
- "Undo depth limit of 10" → absorb into "Op-log undo mechanism"

**Do NOT absorb:**
- If B has its own distinct `reasoning_evidence` that explains a separate
  choice (not just the same choice at a different level)
- If B covers a different scope entirely (different domain area)

### 6.2 SPLIT — Separate Multi-Decision Candidates

**Trigger:** A single candidate's `decision_text` describes two or more
independent choices that could be understood and acted on separately.

**Rules:**
- Each output candidate inherits `source_ref`, `author`, `source_date`
- Each gets its own `title`, `decision_text`, `scope`, `decision_topic`
- `reasoning_evidence`: assign to the relevant decision (may duplicate if ambiguous)
- `confidence`: re-assess per split decision
- `_curation_action`: "split"

**Example:**
```
Input:
  {title: "Restructure backend", decision_text: "Switch from REST to GraphQL
   AND replace SQLAlchemy with SQLModel"}

Output:
  A: {title: "Switch to GraphQL API", decision_text: "Replace REST with GraphQL",
      scope: "api/protocol", topic: "api/protocol-choice", _curation_action: "split"}
  B: {title: "Adopt SQLModel ORM", decision_text: "Replace SQLAlchemy with SQLModel",
      scope: "data/orm", topic: "data/orm-choice", _curation_action: "split"}
```

### 6.3 DISMISS — Remove Clear Non-Decisions

**Trigger:** Candidate represents a mechanical change, implementation
detail, or content already covered by another candidate.

**DISMISS if ALL of these are true (no reasoning + mechanical):**
- No `reasoning_evidence`
- No decision language in `source_context` or `source_body`
- Matches one of these patterns:
  - Version bump with no rationale (e.g., "bump lodash 4.17.20 → 4.17.21")
  - Typo fix (e.g., "fix typo in README")
  - Lock file update with no corresponding dependency change
  - Auto-generated file update with no human-authored changes in same commit

**DISMISS implementation details (even with reasoning_evidence):**
- Test infrastructure choices (fixture selection, test helper patterns)
  UNLESS the candidate represents a deliberate framework decision
  (e.g., "pytest over unittest" is a decision; "use tmp_path fixture"
  is an implementation detail)
- Implementation-level HOW details that are consequences of a captured
  decision (e.g., "semicolon delimiter in CSV" is a formatting detail
  that follows from "export as CSV")
- Candidates where `decision_text` describes mechanical behavior
  rather than a choice between alternatives

**Do NOT dismiss:**
- Scope constraints ("only support Node 18+")
- Default behaviors ("use system default timezone")
- Documentation changes that contain rationale
- Any candidate with distinct `reasoning_evidence` explaining a choice
  between named alternatives
- When in doubt: keep with `confidence: Low`

Track dismissed candidates separately — they appear in the summary.

### 6.4 SYNTHESIZE or FLAG — Compose or Mark Reasoning

For each remaining candidate:

**IF `reasoning_evidence` is present → SYNTHESIZE:**
- Compose a clear `reasoning` statement from the evidence
- Attribute sources: "Based on [commit body/code comment/ADR]: ..."
- Do NOT add information beyond what the evidence contains
- Do NOT extrapolate or speculate about unstated motivations
- Set `_curation_action`: "synthesized"
- Set `_reasoning_source`: "evidence"

**IF `alternatives_evidence` is present:**
- List each rejected alternative with its stated reason

**IF `source_body` contains reasoning not captured in `reasoning_evidence`
(batch agent may have missed it):**
- Extract and add to reasoning. Note: "From commit body: [text]"
- Set `_reasoning_source`: "commit_body"

**IF `reasoning_evidence` is absent → FLAG:**
- Set `reasoning` to: "Not recorded in source."
- Do NOT generate plausible-sounding reasoning
- Do NOT infer reasoning from the `decision_text` alone
- Set `_curation_action`: "flagged"
- Set `_reasoning_source`: "not_recorded"

**ANTI-PATTERN — do NOT do this:**
```
decision_text: "Switch to PostgreSQL"
reasoning: "The team likely chose PostgreSQL for its robust ACID
            compliance and better concurrency support."
            ↑ FABRICATED — no evidence supports this
```

**CORRECT:**
```
reasoning: "Not recorded in source."
```

### 6.5 ASSIGN — Set Final Confidence

For each remaining candidate:

- **High** = explicit decision language in source ("decided", "chose",
  "selected") AND `reasoning_evidence` present
- **Medium** = clear implied choice (dependency swap, structural refactor)
  OR explicit language WITHOUT reasoning evidence
- **Low** = inferred from structure only (file operations, config changes)
  AND no reasoning evidence

### 6.6 Validate

For each curated candidate, verify:
- `title` is present and ≤ 100 characters
- `entry_type` is one of: decision, observation, bug, option_eval,
  learning, gotcha, pivot (NOT "work")
- `provenance` is present with at least one commit reference
- `decision_text` is present and specific (not "made changes")
- `scope` is present (at least one level: "domain")
- `decision_topic` is present
- `confidence` is one of High / Medium / Low
- `reasoning` is present (even if "Not recorded in source.")
- `context` is present (at least 1 sentence)
- `_curation_action` is set

Report any validation failures. Fix before proceeding.

### 6.7 CLASSIFY — Validate Entry Types

For each curated candidate, verify the entry_type from the batch extractor:

- If a "decision" has no named alternatives in its reasoning AND no
  evidence of a choice between options → reclassify as "observation"
- If a "decision" mentions fix/guard/null-check as the action → reclassify
  as "bug"
- If a candidate describes WHAT was implemented with no WHY/HOW reasoning
  → DISMISS (remove from candidate list)
- If an "option_eval" lists only one option → reclassify as "decision"

Update the entry_type field. Log reclassification and dismissal counts.

### 6.8 PERSIST — Write Curated Results to Disk

Before checkpoint cleanup, write the curated JSON array to:
  `<repo_path>/.embranch/extraction-results/curated-<timestamp>.json`

This ensures curated results survive:
- stdout capture failures
- process crashes after curation
- rate limit interruptions

The JSON file is the authoritative source for import.

### Curated Candidate Output Schema

Each curated candidate must conform to this schema for `import_decisions`:

```json
{
  "id": "cand-{hash}-{index}",
  "source_type": "git",
  "source_ref": "{hash}" or ["{hash1}", "{hash2}"],
  "source_date": "{ISO date of most recent contributing commit}",
  "source_context": "{primary commit message}",
  "source_body": "{primary commit body}",
  "author": "{primary author}",
  "files_changed": ["{union of all contributing commits' files}"],
  "entry_type": "decision|observation|bug|option_eval|learning|gotcha|pivot",
  "contributing_strategies": ["message", "diff_comment", ...],

  "provenance": {
    "commits": ["{hash} ({YYYY-MM-DD})", ...],
    "author": "{primary author}",
    "files": ["{path}:{line_range}", ...],
    "issues": ["{ISSUE-REF}", ...]
  },

  "title": "One-line summary",
  "decision_text": "What was decided/observed/found — clear, specific",
  "context": "2-3 sentences explaining the situation and constraints",
  "reasoning": "Synthesized from evidence or 'Not recorded in source.'",
  "alternatives": "Rejected options with reasons (only when evidence exists)",
  "confidence": "High|Medium|Low",
  "status": "Confirmed|Needs Review",
  "scope": "domain/area (slash-separated)",
  "decision_topic": "domain/specific-choice",

  "_curation_action": "merged|split|synthesized|flagged|kept",
  "_reasoning_source": "evidence|commit_body|not_recorded"
}
```

The `_curation_` prefixed fields are debugging metadata — they record
what the orchestrator did and why, but are not imported into Embranch.

### Cleanup:
After successful curation, delete the checkpoint directory:
```
Bash: rm -rf "<repo_path>/.embranch/extraction-checkpoints"
```

---

## Step 7: Present Results

**Show the user ONLY a summary table** — no JSON, no raw agent output:

```
Found N entries (M dismissed). Source: git (X commits scanned).

Dismissed: [list dismissed items briefly]

| # | Title | Type | Confidence |
|---|-------|------|------------|
| 1 | [title] | [entry_type] | [confidence] |
| 2 | [title] | [entry_type] | [confidence] |
...
```

Store the curated JSON internally for import. Do NOT render it to the user.

---

## Step 8: Offer Next Steps

If `auto_import` was detected:
- Call `import_decisions` directly with the curated JSON and the parsed `issue_id`.
- Report the import result.

Otherwise, tell the user:
```
To import: "import these to ISSUE-ID"
To filter: "drop #3, #7 and import to ISSUE-ID"
To select: "only import #1, #4 to ISSUE-ID"
```

## User Assignment
$ARGUMENTS
