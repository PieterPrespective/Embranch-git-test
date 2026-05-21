# Metadata Schemas — Single Source of Truth

**Canonical reference for all Embranch agent workflow metadata fields.**
Update this file first, then propagate changes to agent prompts.

---

## PSDD: `dev-diary` Collection

All diary entries across all issues.

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `issue_id` | **Yes** | string | Issue this entry belongs to | `"EMBR-97"` |
| `entry_type` | **Yes** | string | plan / work / bug / issue / challenge / learning / test / review | `"work"` |
| `date` | **Yes** | string | Date (YYYY-MM-DD) | `"2026-03-11"` |
| `title` | **Yes** | string | Short summary | `"Migrated tool signatures"` |
| `source_id` | **Yes** | string | Document ID (same as the `id` field) | `"EMBR-97-work-20260311-143025-a3f8c2"` |
| `author` | **Yes** | string | Dolt user email | `"pieter.weterings@prespective-software.com"` |
| `created_at` | **Yes** | string | ISO 8601 creation timestamp (immutable) | `"2026-03-11T14:30:25.123456+00:00"` |
| `updated_at` | **Yes** | string | ISO 8601 last-modified timestamp | `"2026-03-11T14:30:25.123456+00:00"` |
| `source_project` | **Yes** | string | Project namespace | `"EMBRPY"` |
| `source_files` | When applicable | string | Comma-separated `path:line` refs | `"src/embranch/tools/doc.py:36"` |
| `schema_version` | **Yes** | string | Schema version (always `"2"` for new entries) | `"2"` |

### 5W1H Metadata Fields

These fields make the implicit Who/What/When/Where/Why/How dimensions explicit and queryable.
They enable multi-dimensional retrieval filtering beyond pure semantic search.

Populate `scope`, `trigger`, and `method` on EVERY entry.
For type-specific fields (`decision_outcome`, `reasoning_summary`), OMIT the field entirely
if not applicable to this entry type — do NOT set to "N/A".

| Field | Required | Type | Populated for | Description | Example |
|-------|----------|------|---------------|-------------|---------|
| `decision_outcome` | When applicable | string | `decision`, `investigation` | Snake_case slug of chosen option | `"magic_link_auth"` |
| `reasoning_summary` | When applicable | string | `decision`, `learning`, `gotcha` | One-sentence WHY | `"Eliminates password support burden"` |
| `scope` | **Yes** | string | All types | Slash-separated domain path (system/component/feature) | `"client-portal/auth"` |
| `trigger` | **Yes** | string | All types | What caused this entry (causal WHY) | `"EMBR-88: migration task"` |
| `method` | **Yes** | string | All types | One-line HOW (approach summary) | `"Evaluated 3 options, rejected 2 on cost"` |

**Population rules:**
- **`decision_outcome`**: Only for `decision` and `investigation` types. Snake_case slug of the chosen option. Omit for other types.
- **`reasoning_summary`**: One sentence max. Extract from Reasoning/Insight section. ONLY for `decision`, `learning`, `gotcha`. OMIT for all other types.
- **`scope`**: Slash-separated path representing system/component/feature domain. Populate for all types. Extract from `source_files` path and content context.
- **`trigger`**: What caused this entry to be created. Especially important for `work` (which task triggered this) and `gotcha` (what were you doing when this hit).
- **`method`**: How the work/decision/investigation was done. Summary of approach. Extract from Approach section.

**Scope format:**
- File-specific entries: `sync-engine/differ.py` or `scripts/code_stats.py`
- Domain-specific entries: `sync-engine/conflict-resolution`
- Broad learnings: use domain path, not descriptions — e.g., `python/ast-module` not "Python ast module usage for code statistics"

**Trigger examples by entry type:**
- plan: `"EMBR-38: delta detection task"`
- work: `"EMBR-38: implementing compute_deltas()"`
- work (step 9): `"EMBR-38: completion gate — final summary"`
- learning: `"EMBR-38: discovered during hash comparison testing"`
- bug: `"EMBR-38: test_sync_conflict_detection failure"`

**Backward compatibility:** Existing entries without these fields remain valid. Retrieval queries handle missing values gracefully.

### Learning-Specific Metadata (dev-diary `learning` entries only)

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `approach_context` | **Yes** for technical learnings | string | Algorithm/approach in use when learned (kebab-case slug). Set to `"approach-agnostic"` if universal. | `"atan2-analytical-per-leg-delta"` |
| `applicability_scope` | **Yes** | string | `"universal"` / `"tool-specific"` / `"approach-specific"` / `"project-specific"` | `"approach-specific"` |

These fields flow through the entire learning pipeline: dev-diary → learnings inbox → filtered_learnings.

### `source_files` Best Practices

- **Format:** `relative/path/to/file.py:line_number` (colon-separated)
- **Multiple files:** Comma-separated: `"src/foo.py:42, src/bar.py:108"`
- **Include for:** Bug entries (where found/fixed), work entries (primary files), learning entries (triggering file), challenge entries (involved files)
- **Omit for:** Plan entries (conceptual), general process learnings, entries about external tools

### Valid `entry_type` Values

| Type | When to Use |
|------|-------------|
| `plan` | Planned approach before implementation |
| `work` | Implementation progress / completion summary |
| `bug` | Bug discovered during work |
| `issue` | Broader issue / concern noted |
| `challenge` | Technical difficulty encountered |
| `learning` | Insight or knowledge gained |
| `test` | Test results / coverage notes |
| `review` | Code review findings |

---

## PSDD: `registry` Collection

One document per tracked issue. ID format: `registry-{issue_id}`.

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `issue_id` | **Yes** | string | Issue ID | `"EMBR-97"` |
| `title` | **Yes** | string | Issue title | `"E2E bug fixes"` |
| `status` | **Yes** | string | active / completed / paused | `"active"` |
| `created` | **Yes** | string | Creation date (YYYY-MM-DD) | `"2026-03-11"` |
| `last_updated` | **Yes** | string | ISO 8601 timestamp of last entry | `"2026-03-11T14:30:25Z"` |
| `entry_count` | **Yes** | string | Number of diary entries (as string) | `"5"` |
| `source_id` | **Yes** | string | Document ID | `"registry-EMBR-97"` |
| `source_project` | **Yes** | string | Project namespace | `"EMBRPY"` |
| `created_by` | **Yes** | string | Author email | `"pieter.weterings@prespective-software.com"` |
| `related_issues` | Optional | string | Comma-separated related IDs | `"EMBR-96,EMBR-98"` |

---

## PSKD: `learnings` Collection (Inbox)

Temporary storage for raw learnings before processing. One document per learning.

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `date` | **Yes** | string | Date learning was made (YYYY-MM-DD) | `"2026-03-11"` |
| `source_issue` | **Yes** | string | Originating issue ID | `"EMBR-97"` |
| `tool` | **Yes** | string | Tool name or `"unknown"` | `"dolt_cli"` |
| `topic` | **Yes** | string | kebab-case topic slug | `"dolt-conflict-skip-commit"` |
| `provenance_diary_id` | **Yes** | string | Dev-diary document ID this came from | `"EMBR-97-learning-20260311-143025-a3f8c2"` |
| `original_entry_type` | **Yes** | string | Diary entry_type (learning/bug/challenge/work) | `"learning"` |
| `offloaded_at` | **Yes** | string | ISO datetime of offload | `"2026-03-11T15:00:00Z"` |
| `author` | **Yes** | string | Dolt user email | `"pieter.weterings@prespective-software.com"` |
| `source_project` | **Yes** | string | Project namespace | `"EMBRPY"` |
| `source_files` | Optional | string | Copied from diary entry if present | `"src/embranch/sync/engine.py:42"` |
| `approach_context` | **Yes** for technical learnings | string | Algorithm/approach in use when learned (kebab-case slug). Set to `"approach-agnostic"` if universal. | `"atan2-analytical-per-leg-delta"` |
| `applicability_scope` | **Yes** | string | `"universal"` / `"tool-specific"` / `"approach-specific"` / `"project-specific"` | `"approach-specific"` |

### Applicability Scope Values

| Value | Meaning | Trust Level at Retrieval |
|-------|---------|------------------------|
| `"universal"` | True regardless of approach | High — apply freely |
| `"tool-specific"` | True for a specific tool across approaches | High — verify tool version |
| `"approach-specific"` | True only within a specific algorithm/approach | Low — verify approach match |
| `"project-specific"` | True only within this specific project | Low — verify project context |

---

## PSKD: `filtered_learnings` Collection (Knowledge Base)

Processed, structured learnings organized by tool/workflow.

### Provenance Fields (PRESERVED from inbox — do NOT rename)

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `author` | **Yes** | string | Dolt user email | `"pieter.weterings@prespective-software.com"` |
| `source_issue` | **Yes** | string | Originating issue ID | `"EMBR-97"` |
| `source_project` | **Yes** | string | Project namespace — **NOT** `project` | `"EMBRPY"` |
| `provenance_diary_id` | **Yes** | string | Dev-diary document ID | `"EMBR-97-learning-20260311-143025-a3f8c2"` |
| `original_entry_type` | **Yes** | string | Diary entry_type | `"learning"` |
| `offloaded_at` | **Yes** | string | ISO datetime of offload — **NOT** `timestamp` | `"2026-03-11T15:00:00Z"` |
| `source_files` | Optional | string | From inbox entry if present | `"src/embranch/sync/engine.py:42"` |

### Classification Fields (ADDED during processing)

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `tool` | **Yes** | string | Identified tool/workflow name | `"dolt_cli"` |
| `topics` | **Yes** | string | Comma-separated topic tags | `"conflict-resolution, merge"` |
| `project_specific` | **Yes** | string | `"true"` or `"false"` | `"false"` |
| `confidence` | **Yes** | string | high / medium / low | `"high"` |
| `date` | **Yes** | string | Date learning was made (YYYY-MM-DD) | `"2026-03-11"` |
| `approach_context` | **Yes** for technical learnings | string | Preserved from inbox. Algorithm/approach in use when learned. | `"atan2-analytical-per-leg-delta"` |
| `applicability_scope` | **Yes** | string | Preserved from inbox. `"universal"` / `"tool-specific"` / `"approach-specific"` / `"project-specific"` | `"tool-specific"` |

### CRITICAL: Field Name Mapping

When processing learnings from inbox → filtered_learnings:

| Inbox Field | filtered_learnings Field | Rule |
|-------------|-------------------------|------|
| `source_project` | `source_project` | PRESERVE exactly — do **NOT** rename to `project` |
| `offloaded_at` | `offloaded_at` | PRESERVE exactly — do **NOT** rename to `timestamp` |
| `original_entry_type` | `original_entry_type` | PRESERVE exactly — do **NOT** drop |
| `provenance_diary_id` | `provenance_diary_id` | PRESERVE exactly |
| `author` | `author` | PRESERVE exactly |
| `source_issue` | `source_issue` | PRESERVE exactly |
| `approach_context` | `approach_context` | PRESERVE exactly |
| `applicability_scope` | `applicability_scope` | PRESERVE exactly |

---

## PSKD: `registry` Collection (Tool Index)

One document per tracked tool/workflow.

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `type` | **Yes** | string | Always `"tool"` or `"workflow"` | `"tool"` |
| `name` | **Yes** | string | Tool/workflow display name | `"Dolt CLI"` |
| `tool_name` | **Yes** | string | Canonical tool key | `"dolt_cli"` |
| `category` | **Yes** | string | Category classification | `"version-control"` |
| `last_updated` | **Yes** | string | Date of last update (YYYY-MM-DD) | `"2026-03-11"` |
| `learning_count` | **Yes** | string | Number of learnings (as string) | `"3"` |
| `related_file_types` | Optional | string | Relevant file extensions | `".py,.md"` |

---

## Server-Managed Metadata (Automatic)

The Embranch server automatically adds these fields during chunking. Do NOT set them manually:

| Field | Description |
|-------|-------------|
| `chunk_index` | Zero-based index of this chunk |
| `total_chunks` | Total number of chunks for this document |
| `content_hash` | SHA-256 hash of full document content |
| `is_local_change` | Set by sync engine (true for MCP writes, false for Dolt-synced) |
| `update_source` | `"mcp_tool"` for MCP writes, `"dolt_sync"` for sync-imported |
