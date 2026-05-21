#!/usr/bin/env node
/**
 * Embranch Plan Mode Guard Hook
 *
 * Enforces Embranch workflow recovery across Plan Mode transitions.
 * Hooks inject additionalContext reminders — they never block Plan Mode.
 *
 * Usage (in .claude/settings.json):
 *   PreToolUse  on EnterPlanMode: node .claude/hooks/embranch-plan-mode-guard.js enter
 *   PostToolUse on ExitPlanMode:  node .claude/hooks/embranch-plan-mode-guard.js exit
 */

const fs = require('fs');
const path = require('path');

const MODE = process.argv[2]; // "enter" or "exit"

const ENTER_WARNING = `[EMBRANCH] You are entering Plan Mode. Diary writes are blocked during planning.
Before entering, verify Steps 0-2 are complete (or they MUST run immediately after exit):
- Step 0: start_issue_session() or query dev-diary for prior sessions
- Step 1: Query knowledge (mcp__pskd__QueryDocuments)
- Step 2: Query diary (mcp__psdd__QueryDocuments)
During planning: note any option evaluations, decisions, and rejected alternatives
— you will need to log them as diary entries after Plan Mode exits.`;

const EXIT_RECOVERY = `[EMBRANCH PLAN MODE RECOVERY] — BLOCKING PREREQUISITES
You just exited Plan Mode. Before ANY code edits or implementation:

1. If the diary session hasn't been started (start_issue_session / Step 0 query) → do it now
2. If knowledge queries (Step 1) haven't run → query mcp__pskd__QueryDocuments now
3. If diary queries (Step 2) haven't run → query mcp__psdd__QueryDocuments now
4. Log your plan to the diary (Step 3) — reference the Plan Mode plan file for traceability

5. DECISION DISTILLATION — review the plan you just created for:
   - option_eval entries: any place you considered multiple approaches → log each with
     options evaluated, trade-offs, chosen option, and rationale
   - decision entries: any deliberate non-obvious choice → log what was chosen,
     why, and what was rejected
   Log these as separate diary entries BEFORE implementation. Decisions made during
   Plan Mode are not captured anywhere persistent — if you skip this, the reasoning
   trail is lost to future sessions.

These are BLOCKING prerequisites per .claude/rules/embranch-dev-workflow.md.
Do NOT begin implementation until all steps are verified complete.`;

function hasEmbranch(cwd) {
  const candidates = [
    path.join(cwd, '.claude', 'rules', 'embranch-dev-workflow.md'),
    path.join(cwd, '.claude', 'rules', 'embranch-workflow.md'),
  ];
  return candidates.some((p) => {
    try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; }
  });
}

function output(hookEventName, context) {
  const result = {
    hookSpecificOutput: {
      hookEventName,
      additionalContext: context,
    },
  };
  process.stdout.write(JSON.stringify(result));
}

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    JSON.parse(inputData);
    const cwd = process.cwd();

    if (!hasEmbranch(cwd)) {
      process.exit(0);
    }

    if (MODE === 'enter') {
      output('PreToolUse', ENTER_WARNING);
    } else if (MODE === 'exit') {
      output('PostToolUse', EXIT_RECOVERY);
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
});

process.stdin.on('error', () => {
  process.exit(0);
});
