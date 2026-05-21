# ChromaDB Where Filter Syntax

**Canonical reference for `where_json` / `where` filter syntax in Embranch queries.**

## Single-Field Filter (valid as-is)

```json
{"field": "value"}
```

Example:
```json
{"entry_type": "learning"}
```

## Multiple Fields — MUST Use `$and`

```json
{"$and": [{"field1": "value1"}, {"field2": "value2"}]}
```

Example:
```json
{"$and": [{"issue_id": "EMBR-97"}, {"entry_type": "learning"}]}
```

## DO NOT Use Bare Multi-Field Dicts

```json
// WRONG — ChromaDB rejects this:
{"issue_id": "EMBR-97", "entry_type": "learning"}
```

ChromaDB requires explicit logical operators for compound conditions. A bare multi-field
dict is ambiguous and will fail with a cryptic error.

## Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$and` | All conditions must match | `{"$and": [{"a": "1"}, {"b": "2"}]}` |
| `$or` | Any condition must match | `{"$or": [{"a": "1"}, {"a": "2"}]}` |

## Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equals (default) | `{"field": {"$eq": "value"}}` |
| `$ne` | Not equals | `{"field": {"$ne": "excluded"}}` |
| `$gt` | Greater than | `{"field": {"$gt": 5}}` |
| `$gte` | Greater than or equal | `{"field": {"$gte": 5}}` |
| `$lt` | Less than | `{"field": {"$lt": 10}}` |
| `$lte` | Less than or equal | `{"field": {"$lte": 10}}` |
| `$in` | In list | `{"field": {"$in": ["a", "b"]}}` |
| `$nin` | Not in list | `{"field": {"$nin": ["a", "b"]}}` |

## Document Content Filters (`where_document`)

| Operator | Description | Example |
|----------|-------------|---------|
| `$contains` | Content contains text | `{"$contains": "sync engine"}` |
| `$not_contains` | Content doesn't contain text | `{"$not_contains": "deprecated"}` |

## Embranch Server Auto-Wrap (Defense in Depth)

The Embranch Python server auto-wraps bare multi-field dicts in `$and` before passing
to ChromaDB (`_normalize_where_filter` in `chroma.py`). However, agents should still
use the explicit `$and` syntax for clarity and portability.

## Usage in MCP Tool Calls

### Claude Code (double-underscore tool names)
```
mcp__psdd__QueryDocuments({
  collectionName: "dev-diary",
  queryTextsJson: "[\"learning\"]",
  whereJson: "{\"$and\": [{\"issue_id\": \"EMBR-97\"}, {\"entry_type\": \"learning\"}]}",
  nResults: 10
})
```

The `whereJson` parameter is always a JSON **string** (not a raw object).
