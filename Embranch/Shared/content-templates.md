# Content Templates — Diary Entry Format Reference

*Canonical reference for structured diary entry content.*
*Source: EMBR-119 Log Format Upgrade, Phase 0.5 — EMBR-130*
*Updated: EMBR-154 — Research-informed quality improvements (EMBR-147)*

---

## Purpose

Every diary entry must be structured, complete, and readable. Templates enforce the six W's
(Who, What, When, Where, Why, How) for each entry type. They serve two audiences:

- **Humans scanning the GUI** — markdown renders with clear visual hierarchy; scannable in seconds
- **LLMs retrieving context** — structured sections are directly parseable; no signal buried in prose

**Who** and **When** are always in metadata (`author`, `created_at`, `date`).
**Where** is partly in metadata (`source_files`, `source_project`) and partly in the Context section.

---

## Conciseness Principle

Be concise. Diary entries are compressed technical logs, not documentation.
Every sentence must contain a technical fact. No narrative framing, no filler, no preamble.

---

## Word Budget and Structural Constraints

| Entry type | Target words | Max words |
|---|---|---|
| `plan` | 150 | 250 |
| `option_eval` | 150 | 250 |
| `pivot` | 150 | 250 |
| `investigation` | 150 | 250 |
| `decision` | 120 | 200 |
| `work` | 120 | 200 |
| `bug` | 120 | 200 |
| `learning` | 120 | 200 |
| `gotcha` | 120 | 200 |
| `review` | 120 | 200 |
| `challenge` | 100 | 180 |
| `observation` | 80 | 150 |
| `outcome` | 80 | 150 |
| `test` | 80 | 150 |
| `work` (completion gate) | 120 | 250 |

Aim for the **target**. The **max** is a hard ceiling for edge cases, not the norm.
Each section: 1-4 bullets, each max one sentence.

---

## Compression and Fact Priority

Be concise. When compressing, keep facts in this priority order (cut from bottom first):

1. **Files changed** — exact paths with line numbers (never compress these)
2. **Actions taken** — specific function/component modified
3. **Errors and root causes** — exact error messages in backticks
4. **Decisions with rationale** — "Decided X because Y"
5. **Next steps and blockers**
6. **Discovery context** — new patterns found, docs referenced (cut first)

Additional rules:
- Never lose facts: numbers, file paths, error messages, version numbers — always preserved verbatim
- Compress narrative framing: "After investigating..." → just state the result
- Use structured markdown, not prose. Bullet lists over paragraphs.
- Keep entries self-contained: each entry must be understandable without retrieving related entries.
- If over budget, cut the least important bullet from the longest section.

---

## Template Enforcement Rules

1. Fill ALL required sections. Write `None` for sections with no content — never omit a section.
2. Do not add sections not in the template.
3. Do not wrap the template in additional prose or preamble.
4. Use the exact section headings from the template (case-sensitive, e.g. `### Root cause`).
5. Bold key-value pairs (`**Decision:**`, `**Status:**`) must appear exactly as specified.
6. Mark all new entries with `schema_version: "2"` in metadata.
7. **One learning per entry.** If multiple learnings exist, create separate diary entries for each. Each entry gets its own metadata (scope, trigger, method) for independent retrieval.

---

## Verify Before Writing

Before submitting any diary entry, check these 3 items:

1. **Template**: section headings match the entry_type template exactly
2. **Metadata**: scope, trigger, and method are all populated; decision_outcome/reasoning_summary are OMITTED for non-applicable types
3. **Length**: at most the word budget for this entry type — if over, cut least important bullet

---

## Templates by Entry Type

---

### `decision`

Target 120 words (max 160). Each section: 1-4 bullets, each max one sentence.

~~~
## [Short decision title]

**Decision:** [what was chosen]
**Status:** Accepted | Rejected | Pending | Superseded
**Confidence:** High | Medium | Low

### Context
[2–4 sentences: situation that forced this decision, constraints]

### Reasoning
[Why this option was chosen over alternatives]

### Alternatives considered
- **[Option A]** — Rejected: [reason]
- **[Option B]** — Rejected: [reason]

### Open questions
- [Any unresolved follow-up, or "None currently"]
~~~

<example type="decision" note="correctly compressed, 108 words">
## Use SQLite for sync state tracking

**Decision:** SQLite for local sync state
**Status:** Accepted
**Confidence:** High

### Context
Sync engine needs persistent tracking of document states across sessions. Options: Dolt table, SQLite, or in-memory cache.

### Reasoning
Operational metadata belongs in local storage (PP13-69). SQLite is zero-config, single-file, perfect for per-KB state.

### Alternatives considered
- **Dolt table** — Rejected: versioned storage for operational data causes merge conflicts
- **In-memory** — Rejected: lost on restart, no persistence

### Open questions
- None currently
</example>

---

### `investigation`

Target 100 words (max 130). Each section: 1-4 bullets, each max one sentence.

~~~
## [Question being investigated]

**Recommendation:** [conclusion reached, or "No conclusion yet"]

### Findings
[Key facts discovered, numbered or bulleted]

### Sources
- [Tool / doc / experiment that produced each finding]

### Next steps
- [What should happen based on these findings]
~~~

<example type="investigation" note="correctly compressed, 92 words">
## Can FastMCP handle multiple knowledge bases in one process?

**Recommendation:** Yes, use namespace isolation with distinct file paths

### Findings
- FastMCP 3.x supports multiple tool registrations per server
- Each KB gets its own ChromaDB PersistentClient path
- Memory isolation via Python dict keyed by namespace

### Sources
- FastMCP docs: multi-tool registration
- ChromaDB PersistentClient API: separate `path` per instance

### Next steps
- Implement `KBManager` with namespace-to-backend mapping
- Add LRU eviction for memory pressure
</example>

---

### `gotcha`

Target 80 words (max 110). Each section: 1-4 bullets, each max one sentence.

~~~
## [Short problem title]

**Impact:** [who/what is affected]
**Severity:** Blocker | High | Medium | Low

### Problem
[Exact symptom observed — error message, behavior, output]

### Root cause
[Why it happened]

### Fix applied
[Specific code/config change that resolved it]

### Prevention
[Rule or check to prevent recurrence]
~~~

<example type="gotcha" note="correctly compressed, 85 words">
## ChromaDB rejects bare multi-field where filters

**Impact:** All diary queries with compound filters fail
**Severity:** High

### Problem
`where={"issue_id": "EMBR-97", "entry_type": "learning"}` raises `ValueError: Expected one of $and, $or`

### Root cause
ChromaDB requires explicit `$and` operator for multi-field conditions. Bare dicts are ambiguous.

### Fix applied
Wrapped in `$and`: `{"$and": [{"issue_id": "EMBR-97"}, {"entry_type": "learning"}]}`

### Prevention
Always use `$and` for compound `where_json` filters. Added auto-wrap in `_normalize_where_filter`.
</example>

---

### `learning`

Target 85 words (max 115). Each section: 1-4 bullets, each max one sentence.

**One learning per entry.** If you have multiple learnings, create separate diary entries for each.

~~~
## [Insight in one line]

**Confidence:** High | Medium | Low
**Applicability:** [scope — this project / this tool / general]

### Insight
[The learning, stated precisely]

### Context
[When/where this was discovered]

### Evidence
- [Specific example or experiment]

### How to apply
[Concrete rule derived from this learning]

### Boundaries
[When this does NOT apply, or "No known boundaries"]
~~~

<example type="learning" note="correctly compressed, 82 words">
## Dolt COMMIT must be skipped during active merge conflict transactions

**Confidence:** High
**Applicability:** Dolt CLI / general

### Insight
Calling `DOLT_COMMIT` inside a merge conflict resolution transaction causes a deadlock.

### Context
Discovered during EMBR-39 conflict resolution integration tests.

### Evidence
- `DOLT_MERGE` + `DOLT_COMMIT` in same transaction → timeout after 30s

### How to apply
Skip explicit COMMIT after merge resolution. Dolt auto-commits on transaction close.

### Boundaries
- Only applies to Dolt merge conflict transactions; standalone COMMIT calls are fine
</example>

<example type="learning" note="different topic, 78 words">
## Single-chunk documents use bare base ID, not {id}_chunk_0

**Confidence:** High
**Applicability:** Embranch / this project

### Insight
Documents under the chunk threshold are stored with their base ID directly, not suffixed with `_chunk_0`.

### Context
Discovered during EMBR-41 sync engine integration tests.

### Evidence
- `get_documents(id="doc-1")` returns content; `get_documents(id="doc-1_chunk_0")` returns empty

### How to apply
Query by base ID first. Only use chunk suffixes for multi-chunk documents.

### Boundaries
No known boundaries
</example>

---

### `work`

Target 90 words (max 120). Each section: 1-4 bullets, each max one sentence.

~~~
## [What was done — verb phrase]

**Summary:** [1–2 sentence result]

### Approach
[How the work was structured — brief method description, not a narration]

### Changes
- `path/to/file.py:NN` — [what changed]
- `path/to/other.py:NN` — [what changed]

### Issues encountered
- [Any problems discovered during this work, or "None"]
~~~

Note: Summary and Changes must not repeat the same statistics. Summary states the result; Changes lists the files.

<example type="work" note="correctly compressed, 95 words">
## Implemented delta detection for sync engine

**Summary:** Added `differ.py` with `compute_deltas()` comparing vector/Dolt snapshots. 3 delta types: add, update, delete.

### Approach
Fetch both sides via backend/dolt interfaces, diff by document ID, classify changes by content hash comparison.

### Changes
- `src/embranch/sync/differ.py:1` — new module, `compute_deltas()` + `DeltaResult` model
- `src/embranch/models/sync.py:45` — added `DeltaType` enum, 3 members
- `tests/unit/test_differ.py:1` — 12 unit tests for delta classification

### Issues encountered
- None
</example>

<example type="work" note="completion gate entry, 88 words">
## Applied EMBR-147 diary quality improvements to agent prompts

**Summary:** Updated all diary-related agent files with research-backed prompt improvements across both platforms.

### Approach
Applied N1 (conciseness), A1-R (examples), A2-R (structural constraints), A3-R (5W1H required), N3 (XML structure), N4 (critical-reminder) from EMBR-147 improvement plan.

### Changes
- `AgentWorkflow/Shared/content-templates.md:1` — replaced token budgets, added examples
- `AgentWorkflow/Shared/metadata-schemas.md:25` — 5W1H now required
- `AgentWorkflow/ClaudeCode/.claude/agents/dev-diary-agent.md:1` — restructured with XML tags

### Issues encountered
- None
</example>

<example type="work" note="different domain, 78 words">
## Migrated Dolt CLI wrapper to asyncio subprocess

**Summary:** Replaced synchronous `subprocess.run` calls with `asyncio.create_subprocess_exec` in `dolt/cli.py`.

### Approach
Converted each CLI method to async, added stdout/stderr capture, error handling for non-zero exit codes.

### Changes
- `src/embranch/dolt/cli.py:1` — all methods now async, use `create_subprocess_exec`
- `tests/unit/test_dolt_cli.py:1` — converted to `@pytest.mark.asyncio`

### Issues encountered
- `NO_COLOR=1` env var needed to prevent ANSI codes in output
</example>

---

### `plan`

Target 120 words (max 160). Each section: 1-4 bullets, each max one sentence.

~~~
## [Goal — what will be achieved]

**Target:** [Week N or specific date]

### Approach
[Steps to achieve the goal]

### Dependencies
- [What must be true/done before this can start]

### Risks
- [What could go wrong]

### Success criteria
- [How we know this is done]
~~~

<example type="plan" note="correctly compressed, 112 words">
## Implement bidirectional sync engine for Embranch Python

**Target:** 2026-03-15

### Approach
- Port C# sync logic to Python in 7 phases: models, converter, SQLite tracker, delta detection, conflict resolution, engine, testing
- Use SQLite for sync state (not Dolt — operational data stays local per PP13-69)
- Each phase has dedicated module + unit tests

### Dependencies
- EMBR-32/33 (VectorBackend + ChromaDB) must be completed
- EMBR-31 (Dolt CLI wrapper) must be completed

### Risks
- Conflict resolution edge cases may differ from C# behavior
- SQLite locking under concurrent access

### Success criteria
- All 7 phases pass unit + integration tests
- Full round-trip sync between ChromaDB and Dolt
</example>

---

### `review`

Target 70 words (max 100). Each section: 1–4 bullets, each max one sentence.

~~~
## [Subject being reviewed]

**Assessment:** Approved | Approved with changes | Blocked | Deferred

### Summary
[1–2 sentence overall assessment]

### Recommendations
- [Specific change to make, or "None"]

### Blockers
- [Hard blocker before approval, or "None"]
~~~

<example type="review" note="correctly compressed, 65 words">
## Review: EMBR-38 delta detection implementation

**Assessment:** Approved with changes

### Summary
Delta detection logic is correct and well-tested. Minor API change needed for consistency.

### Recommendations
- Rename `compute_deltas()` to `detect_deltas()` to match sync engine naming convention
- Add `__all__` export list to `differ.py`

### Blockers
- None
</example>

---

### `bug`

Target 90 words (max 120). Each section: 1-4 bullets, each max one sentence.

~~~
## [Bug title — component + symptom]

**Severity:** Blocker | High | Medium | Low
**Status:** Open | Fixed | Deferred

### Symptom
[Exact observable behavior — error message, wrong output, etc.]

### Reproduction
[Minimal steps to reproduce]

### Root cause
[Why the bug occurred]

### Fix
[Specific change applied]

### Verification
[How fix was confirmed — test, manual check, etc.]
~~~

<example type="bug" note="correctly compressed, 95 words">
## dolt_cli.py — init fails on paths with spaces

**Severity:** High
**Status:** Fixed

### Symptom
`DoltCli.init("C:/My Projects/kb1")` raises `FileNotFoundError: No such file or directory`

### Reproduction
1. Call `dolt_cli.init(path)` where `path` contains spaces
2. `create_subprocess_exec` splits the path at spaces

### Root cause
Path was passed as single string to `create_subprocess_exec` which expected separate args. Spaces caused argument splitting.

### Fix
`src/embranch/dolt/cli.py:42` — pass path as quoted argument, resolve to absolute with `Path.resolve()`

### Verification
Added `test_init_path_with_spaces` — passes on Windows and Linux
</example>

---

### `option_eval`

Target 150 words (max 250). Each section: 1-4 bullets, each max one sentence.

~~~
## [Decision context — what are we choosing between?]

**Selected:** [chosen option]
**Confidence:** High | Medium | Low

### Options Evaluated
1. **[Option A]** — [1-sentence description]
   - Pros: [advantages]
   - Cons: [disadvantages]
   - Verdict: Selected | Rejected: [reason]
2. **[Option B]** — [1-sentence description]
   - Pros: [advantages]
   - Cons: [disadvantages]
   - Verdict: Selected | Rejected: [reason]

### Rationale
[Why the selected option wins]

### Assumptions
- [What must be true for this choice to hold]

### Revisit Triggers
- [Conditions under which we should reconsider]
~~~

<example type="option_eval" note="correctly compressed, 138 words">
## AST traversal strategy for nested function counting

**Selected:** NodeVisitor
**Confidence:** High

### Options Evaluated
1. **ast.walk** — Flat iteration, simple filter via isinstance
   - Pros: shortest code
   - Cons: loses structural context, no parent tracking
   - Verdict: Rejected: can't attribute nested functions to enclosing class
2. **NodeVisitor subclass** — visit_FunctionDef with automatic recursion
   - Pros: idiomatic, handles async via visit_AsyncFunctionDef, generic_visit recurses
   - Cons: slightly more boilerplate
   - Verdict: Selected
3. **Manual recursion** — Walk node.body manually
   - Pros: full control
   - Cons: duplicates what NodeVisitor does
   - Verdict: Rejected: no benefit over NodeVisitor

### Rationale
Spec requires counting both top-level and nested; NodeVisitor + generic_visit is the cleanest fit.

### Assumptions
- No need to distinguish nested from top-level in output

### Revisit Triggers
- If parent attribution becomes required
</example>

---

### `observation`

Target 80 words (max 150). Each section: 1-4 bullets, each max one sentence.

~~~
## [What was observed — factual statement]

**Category:** behavior | constraint | pattern | dependency | performance
**Relevance:** High | Medium | Low

### Observation
[Precise description of what was noticed]

### Context
[What the agent was doing when this was observed]

### Implication
[Why this matters]

### Evidence
- [File, line, error message, or output]
~~~

<example type="observation" note="correctly compressed, 76 words">
## Path.relative_to preserves OS separators in report output

**Category:** behavior
**Relevance:** Medium

### Observation
Generated Markdown report shows `scripts\code_stats.py` on Windows due to `str(Path)` using `os.sep`.

### Context
Running code_stats.py on Windows; report committed cross-platform.

### Implication
Reports diffed across OSes have noisy path diffs. Use `path.as_posix()` at render boundary.

### Evidence
- Same source tree produces `scripts/code_stats.py` on Linux, `scripts\code_stats.py` on Windows
</example>

---

### `outcome`

Target 80 words (max 150). Each section: 1-4 bullets, each max one sentence.

~~~
## [Action result — "X succeeded/failed"]

**Status:** Success | Partial | Failed
**Action:** [what was attempted]

### Result
[What happened — specific output or behavior]

### Verification
[How the result was confirmed]

### Follow-up
[What this means for next steps — "None" if clean success]
~~~

<example type="outcome" note="correctly compressed, 72 words">
## All 20 unit tests pass on first run

**Status:** Success
**Action:** Run pytest test suite for code_stats module

### Result
`uv run pytest tests/unit/test_code_stats.py -v` — 20 passed in 0.13s (Python 3.14.4, pytest 9.0.3).

### Verification
All walker, LOC counting, AST analysis, summary, report, and CLI tests green. No flakiness observed.

### Follow-up
- None — proceeding to final summary
</example>

---

### `pivot`

Target 150 words (max 250). Each section: 1-4 bullets, each max one sentence.

~~~
## [Short pivot title — "From X to Y"]

### What Triggered the Pivot
[Exact error, constraint, or realization]

### Why the Original Approach Failed
[Root cause]

### Why the New Approach Should Work
[What's different]

### What Was Preserved
[Work that carries over]

### What Was Discarded
[Work thrown away]
~~~

<example type="pivot" note="correctly compressed, 105 words">
## From regex-based LOC counting to AST + text hybrid

### What Triggered the Pivot
Regex approach miscounted multi-line strings as code — `re.findall(r'^[^#\n]', src, re.M)` matched inside triple-quoted blocks.

### Why the Original Approach Failed
Regex operates on raw text without parse context; can't distinguish string literals from code.

### Why the New Approach Should Work
AST for structure (function/class detection), simple text-scan for LOC (non-blank, non-`#` lines). Text-scan correctly counts lines inside strings as code per spec.

### What Was Preserved
- File walking logic, dataclass models, CLI argument parser

### What Was Discarded
- `count_loc_regex()` function (~15 lines)
</example>

---

### `challenge`

Target 100 words (max 180). Each section: 1-4 bullets, each max one sentence.

~~~
## [What was challenging]

### Challenge
[What made this harder than expected]

### Resolution
[How it was resolved, or "Unresolved"]
~~~

<example type="challenge" note="correctly compressed, 68 words">
## Async subprocess mock isolation in pytest-asyncio

### Challenge
Mocking `asyncio.create_subprocess_exec` required patching at the `asyncio` module level, but pytest-asyncio's event loop reuse caused mock leaks between tests.

### Resolution
Used `unittest.mock.AsyncMock` with `return_value.communicate = AsyncMock(return_value=(stdout, stderr))` pattern and added explicit `mock.reset_mock()` in fixture teardown.
</example>

---

### `test`

Target 80 words (max 150). Each section: 1-4 bullets, each max one sentence.

~~~
## [Test summary — what was tested]

### Test Results
[Pass/fail counts, runtime, key observations]

### Coverage
[What was covered and what was not]

### Issues
[Problems found, or "None"]
~~~

<example type="test" note="correctly compressed, 65 words">
## Sync engine integration tests — full round-trip

### Test Results
12/12 passed in 3.2s. ChromaDB + Dolt real instances. No flaky tests.

### Coverage
- Add, update, delete sync paths
- Conflict detection + resolution (last-write-wins, manual)
- Branch checkout + merge sync

### Issues
- None
</example>

---

## Schema Versioning

New entries written with these templates should include `schema_version: "2"` in metadata.
Existing v1 entries (without this field) remain valid and display with legacy format.
No backfill required — enrichment of old entries happens opportunistically.
