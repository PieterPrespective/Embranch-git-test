#!/usr/bin/env node
/**
 * Logs PSDD (Dev Diary Database / Python Embranch) tool actions to the dev diary agent log file
 * Called by PostToolUse hook - receives input via stdin as JSON
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = 'dev-diary-agent-log.txt';

// Read input from stdin
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);

    const toolName = input.tool_name || 'unknown';
    const toolInput = input.tool_input || {};
    const sessionId = input.session_id || 'unknown';
    const cwd = input.cwd || process.cwd();

    // Determine operation type (Python Embranch uses snake_case tool names)
    function getOperationType(name) {
      if (name.includes('diary_jot_flush')) return 'FLUSH';
      if (name.includes('diary_jot_count')) return 'READ';
      if (name.includes('diary_jot')) return 'JOT';
      if (name.includes('add_') || name.includes('create_')) return 'CREATE';
      if (name.includes('query_') || name.includes('get_') || name.includes('list_') || name.includes('peek_')) return 'READ';
      if (name.includes('update_') || name.includes('modify_')) return 'UPDATE';
      if (name.includes('delete_')) return 'DELETE';
      if (name.includes('preview_import')) return 'IMPORT_PREVIEW';
      if (name.includes('execute_import')) return 'IMPORT_EXECUTE';
      if (name.includes('dolt_') || name.includes('bootstrap_') || name.includes('repository_') || name.includes('manifest_') || name.includes('sync_to_')) return 'VERSION';
      return 'OTHER';
    }

    // Get collection from input — Python uses `collection_name` for doc tools, `name` for collection tools
    function getCollection(inp) {
      if (inp.source_path) return `import:${inp.source_path.split(/[\\\/]/).pop()}`;
      return inp.collection_name || inp.name || 'system';
    }

    // Format timestamp
    function getTimestamp() {
      return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    const operation = getOperationType(toolName);
    const collection = getCollection(toolInput);
    const timestamp = getTimestamp();
    const shortToolName = toolName.replace('mcp__psdd__', '');

    const inputStr = JSON.stringify(toolInput);
    const logEntry = `[${timestamp}] ${operation} ${collection}: ${shortToolName}
    Input: ${inputStr.slice(0, 200)}${inputStr.length > 200 ? '...' : ''}
    Session: ${sessionId.slice(0, 8)}
`;

    // Append to log file
    const logPath = path.join(cwd, LOG_FILE);
    fs.appendFileSync(logPath, logEntry);

    // Output success
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);

  } catch (e) {
    // Non-blocking error - just log to stderr
    console.error('Hook error:', e.message);
    process.exit(0); // Exit 0 to not block the operation
  }
});

// Handle case where stdin closes immediately
process.stdin.on('error', () => {
  process.exit(0);
});
