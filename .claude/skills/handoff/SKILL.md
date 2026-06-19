---
description: End-of-session handoff — summarize changes, list follow-ups, and persist corrections/preferences to memory
---

# Handoff Skill

At the end of this session, do the following in order:

## 1. Summarize changes made this session

List every file that was created, edited, or deleted. For each, write one sentence describing what changed and why.

## 2. List follow-ups

List any unresolved tasks, known issues, pending decisions, or next steps the user should be aware of before the next session. Be specific — include file names and line numbers where relevant.

## 3. Append corrections and preferences to memory

Read the current session for any corrections the user made to Claude's approach, any preferences they stated, or any non-obvious conventions that were established. Append these as new entries to the project memory system at:

`C:\Users\user\.claude\projects\c--BSc-Computer-Science-Slides-Capstone-Project-DapurNyonya\memory\`

- If a relevant memory file already exists, update it.
- If the correction is new, create a new feedback memory file and add it to `MEMORY.md`.
- Use the feedback memory format: lead with the rule, then a **Why:** line and a **How to apply:** line.
