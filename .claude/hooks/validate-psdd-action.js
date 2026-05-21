#!/usr/bin/env node
/**
 * Validates PSDD (Dev Diary Database / Python Embranch) tool actions before execution
 * Called by PreToolUse hook - receives input via stdin as JSON
 * Exit 0 to allow, exit 2 to block with error message
 *
 * Validation rules:
 * 1. add_documents to 'dev-diary' must include issue_id, entry_type, author, created_at in metadata
 * 2. Cannot delete the 'registry' collection
 * 3. entry_type must be one of the allowed values
 * 4. execute_import must target staging collections only
 */

const VALID_ENTRY_TYPES = [
  'plan', 'work', 'bug', 'issue', 'challenge', 'learning', 'test', 'review',
  'option_eval', 'observation', 'pivot', 'outcome', 'decision', 'gotcha',
  'investigation', 'session_start',
];
const PROTECTED_COLLECTIONS = ['registry'];

// Read input from stdin
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);

    const toolName = input.tool_name || '';
    const toolInput = input.tool_input || {};

    // Skip validation for jot buffer tools (server handles validation internally)
    const JOT_TOOLS = ['diary_jot', 'diary_jot_count', 'diary_jot_flush'];
    if (JOT_TOOLS.some(t => toolName.includes(t))) {
      process.exit(0);
    }

    // Rule 1: Block deletion of protected collections
    // Python Embranch uses `name` for collection tools
    if (toolName.includes('delete_collection')) {
      const collection = toolInput.name || toolInput.collection_name;
      if (PROTECTED_COLLECTIONS.includes(collection)) {
        console.error(`BLOCKED: Cannot delete protected collection '${collection}'`);
        process.exit(2);
      }
    }

    // Rule 2: Validate add_documents to dev-diary has required metadata (including provenance)
    if (toolName.includes('add_documents')) {
      // Python Embranch uses `collection_name` consistently
      const collection = toolInput.collection_name;

      if (collection === 'dev-diary' && toolInput.documents_json) {
        try {
          const documents = JSON.parse(toolInput.documents_json);

          for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const meta = doc.metadata || {};

            // Check required field: issue_id
            if (!meta.issue_id) {
              console.error(`BLOCKED: add_documents to 'dev-diary' requires 'issue_id' in metadata (document index ${i})`);
              process.exit(2);
            }

            // Check required field: entry_type
            if (!meta.entry_type) {
              console.error(`BLOCKED: add_documents to 'dev-diary' requires 'entry_type' in metadata (document index ${i})`);
              process.exit(2);
            }

            // Check entry_type is valid
            if (!VALID_ENTRY_TYPES.includes(meta.entry_type)) {
              console.error(`BLOCKED: Invalid entry_type '${meta.entry_type}'. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
              process.exit(2);
            }

            // Check provenance: author (required)
            if (!meta.author) {
              console.error(`BLOCKED: add_documents to 'dev-diary' requires 'author' in metadata (document index ${i})`);
              process.exit(2);
            }

            // Check provenance: created_at (required)
            if (!meta.created_at) {
              console.error(`BLOCKED: add_documents to 'dev-diary' requires 'created_at' in metadata (document index ${i})`);
              process.exit(2);
            }
          }
        } catch (parseErr) {
          // If documents_json can't be parsed, block with helpful message
          console.error('BLOCKED: Cannot parse documents_json — required for dev-diary add_documents');
          process.exit(2);
        }
      }

      // Also block add_documents to dev-diary without documents_json
      if (collection === 'dev-diary' && !toolInput.documents_json) {
        console.error('BLOCKED: add_documents to \'dev-diary\' requires documents_json with issue_id, entry_type, author, and created_at in metadata');
        process.exit(2);
      }
    }

    // Rule 3: execute_import must target staging collection only
    if (toolName.includes('execute_import')) {
      const collectionFilter = toolInput.collection_filter;
      if (collectionFilter) {
        try {
          const filterObj = JSON.parse(collectionFilter);
          if (filterObj.collections) {
            for (const mapping of filterObj.collections) {
              const target = mapping.import_into;
              if (target && !target.startsWith('import-staging-')) {
                console.error(
                  `BLOCKED: execute_import must target a staging collection (import-staging-*), not '${target}'`
                );
                process.exit(2);
              }
            }
          }
        } catch (e) {
          // If filter can't be parsed, allow (import may use default mapping)
        }
      }
    }

    // All checks passed - allow the operation
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);

  } catch (e) {
    // On parse error, allow the operation (fail open)
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
});

// Handle case where stdin closes immediately
process.stdin.on('error', () => {
  process.exit(0);
});
