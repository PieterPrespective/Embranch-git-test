# Document ID Formats

**Canonical reference for all Embranch document ID generation rules.**

## Design Principles

- **Second-resolution timestamps** for human readability and chronological sorting
- **6-character hex random suffix** for collision resistance across:
  - Rapid same-user writes (sub-second)
  - Parallel users working on the same issue
  - Branch merges combining concurrent work
- **No pre-chunking** — the server appends `_chunk_N` suffixes automatically

## Diary Entries (`dev-diary` collection)

```
Format:  {issue_id}-{entry_type}-{YYYYMMDD-HHmmss}-{6hex}
Example: EMBR-97-work-20260311-143025-a3f8c2
```

| Component | Description |
|-----------|-------------|
| `issue_id` | Issue ID (e.g., `EMBR-97`) |
| `entry_type` | plan / work / bug / issue / challenge / learning / test / review |
| `YYYYMMDD-HHmmss` | UTC timestamp with second resolution |
| `6hex` | 6-character lowercase hex random suffix |

After chunking, the server produces: `EMBR-97-work-20260311-143025-a3f8c2_chunk_0`, `..._chunk_1`, etc.

## Knowledge Inbox (`learnings` collection)

```
Format:  learning_{issue_id}_{YYYYMMDD}_{NNN}-{6hex}
Example: learning_EMBR-97_20260311_001-a3f8c2
```

| Component | Description |
|-----------|-------------|
| `issue_id` | Source issue ID |
| `YYYYMMDD` | Date of learning |
| `NNN` | Sequential number within the batch (001, 002, ...) |
| `6hex` | 6-character lowercase hex random suffix |

## Filtered Learnings (`filtered_learnings` collection)

```
Format:  {tool}_{topic_slug}_{6hex}
Example: dolt_cli_conflict-skip-commit_a3f8c2
```

Generated during `/knowledge process learnings`. The `6hex` suffix ensures uniqueness.

## Registry — PSDD (`registry` collection)

```
Format:  registry-{issue_id}
Example: registry-EMBR-97
```

**No random suffix** — registry entries are singletons by design (one per issue).

## Registry — PSKD (`registry` collection)

```
Format:  tool_{tool_name}
Example: tool_dolt_cli
```

**No random suffix** — registry entries are singletons by design (one per tool).

## Backward Compatibility

Existing documents with the old `HHmm` format (no seconds, no hex suffix) remain valid.
New documents use the collision-resistant format. No migration is needed.

## Generating the 6-Hex Suffix

### Python (for Claude Code Agent subagents)
```python
import secrets
suffix = secrets.token_hex(3)  # e.g., "a3f8c2"
```

### LLM Agents (no runtime access)
Generate 6 random hexadecimal characters (0-9, a-f). Example: `a3f8c2`, `7b2e1d`, `f09ab4`.
