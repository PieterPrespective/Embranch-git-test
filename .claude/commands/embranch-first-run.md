# Embranch First Run Validation

You are the Embranch First Run Agent. Your job is to validate that the Embranch
installation in this project is working correctly. Run through all six phases
in order, reporting results after each phase.

## Quick Reference

- **Phases 1-3, 6**: Run locally via the `validate_installation` MCP tool
- **Phases 4-5**: You execute MCP calls directly and interpret results
- **Blocker failures**: Stop and help fix before continuing to the next phase
- **Non-blocker failures**: Note them and continue

## Phase 1-3 & 6: Local Validation

Call the validation tool to run all local phases:

```
validate_installation(project_root=".", harness="ClaudeCode", phases=["environment", "configuration", "hooks", "desktop", "flavor_specific"])
```

Present results as a table for each phase:

| Check | Status | Detail |
|-------|--------|--------|
| ... | PASS/FAIL/WARN/SKIP | ... |

If any **blocker** check fails, STOP and present the remediation steps.
Ask: "Would you like to fix this now, or continue with remaining checks?"

## Phase 4: MCP Server Connectivity

Execute these MCP calls and report what happens:

1. **PSDD Server Version** (Blocker):
   Call `mcp__psdd__GetServerVersion()` — report version or error

2. **PSDD Dev-Diary Collection** (Blocker):
   Call `mcp__psdd__QueryDocuments(collectionName="dev-diary", queryTextsJson="[\"test\"]", nResults=1)`

3. **PSDD Registry Collection** (Degraded):
   Call `mcp__psdd__QueryDocuments(collectionName="registry", queryTextsJson="[\"test\"]", nResults=1)`

4. **PSDD Dolt Status** (Degraded):
   Call `mcp__psdd__DoltStatus()` — report branch and commit

5. **PSKD Server Version** (Degraded — optional):
   Call `mcp__pskd__GetServerVersion()` — skip if PSKD not configured

6. **PSKD Filtered Learnings** (Advisory):
   Call `mcp__pskd__QueryDocuments(collectionName="filtered_learnings", queryTextsJson="[\"test\"]", nResults=1)`

7. **PSKD Registry** (Advisory):
   Call `mcp__pskd__QueryDocuments(collectionName="registry", queryTextsJson="[\"test\"]", nResults=1)`

Report each result. If PSDD is unreachable, skip Phase 5.

## Phase 5: Diary Roundtrip

End-to-end write/read/delete test of the diary system:

1. **Generate test ID**: Use timestamp format `FIRSTRUN-TEST-YYYYMMDD-HHmmss`

2. **Write** (Blocker):
   ```
   mcp__psdd__AddDocuments(
     collectionName="dev-diary",
     idsJson="[\"FIRSTRUN-TEST-{ts}\"]",
     documentsJson="[\"First-run validation test entry — safe to delete\"]",
     metadatasJson="[{\"issue_id\":\"FIRSTRUN-TEST\",\"entry_type\":\"test\",\"date\":\"{today}\",\"title\":\"First-run validation test\",\"source_id\":\"FIRSTRUN-TEST-{ts}\",\"schema_version\":\"2\",\"scope\":\"validation/first-run\",\"trigger\":\"first-run agent validation\",\"method\":\"automated test entry\"}]"
   )
   ```

3. **Read** (Blocker): Read it back and verify content matches:
   ```
   mcp__psdd__GetDocuments(collection_name="dev-diary", ids=["FIRSTRUN-TEST-{ts}"])
   ```

4. **Delete** (Advisory — cleanup):
   ```
   mcp__psdd__DeleteDocuments(collectionName="dev-diary", idsJson="[\"FIRSTRUN-TEST-{ts}\"]")
   ```

5. **Check logging**: Look at `dev-diary-agent-log.txt` — did it grow? (PostToolUse hook test)

If write fails, skip read and delete. If read fails, still attempt delete.

## Summary Report

After all phases complete, present:

```
## Embranch Installation Validation Report

**Environment:** {CLI/Desktop} on {OS}
**Overall:** {PASS / DEGRADED / FAIL}

| Phase | Status | Passed | Issues |
|-------|--------|--------|--------|
| 1. Environment | ✓/✗ | N/M | ... |
| 2. Configuration | ✓/✗ | N/M | ... |
| 3. Hook Execution | ✓/✗ | N/M | ... |
| 4. MCP Connectivity | ✓/✗ | N/M | ... |
| 5. Diary Roundtrip | ✓/✗ | N/M | ... |
| 6. Desktop-Specific | ✓/✗/— | N/M | ... |

### Issues Found
(List each with remediation)

### What Works
(Confirmed-working features)
```

## Remediation Loop

For each issue found:
1. Present the issue and fix to the user
2. Ask "Fix now, or continue?"
3. If fixing: guide through the fix, then re-run that specific check
4. If continuing: note as unresolved and move on

## Desktop Mode Guidance

If Phase 6 detects Desktop mode, inform the user:

"You're running in Claude Desktop code mode. Key things to know:
1. **PreToolUse hooks work** — diary validation hooks are active
2. **PostToolUse hooks may not fire** — logging hooks might not work (known issue)
3. **PermissionRequest hooks are skipped** — Desktop UI handles permissions instead
4. All checks that passed are confirmed working in your specific environment."

## Edge Cases

- **No MCP servers**: Skip phases 4-5, report "MCP servers not available"
- **No dev-diary collection**: Suggest running `bootstrap_repository`
- **On main branch**: Warn "Diary writes blocked on main — switch to a work branch"
- **First-time setup**: Guide through initial bootstrap if collections are missing
