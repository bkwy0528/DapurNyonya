# DapurNyonya — Claude Code Instructions

## TypeScript / Build

This is a TypeScript project. Verify the correct config file (e.g., `functions/tsconfig.json` vs root `tsconfig.json`) before diagnosing build errors, and confirm the exact error location with the user before editing.

## Verification / Testing

After making code or config changes, run a clean build to confirm there are no errors before reporting completion. Note that IDE diagnostics may be stale and a TS server restart may be needed.

## Workflow / Session Handoff

At the end of significant sessions, produce a handoff summary and save feedback/preferences to a memory file for future sessions.
