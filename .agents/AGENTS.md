# Workspace Identity Rules

## Core Identity
Always remember the core identity of this startup:
**Avoir (Prachar.ai) is striving to be an AI NATIVE AGENCY + AI HEDGE FUND COMBO.**

## Startup Pivot (No Longer a Hackathon)
**CRITICAL:** This project has officially pivoted from an AWS Hackathon submission to a full SaaS Startup. 
NEVER refer to this project as a "hackathon project" or "hackathon submission". Treat it as a real, multimillion-dollar SaaS startup.

Whenever discussing the project, suggesting copy, refining UI, or writing documentation, always ensure this dual identity (quantitative finance intersection with digital marketing execution) is preserved and emphasized. Do not lean too far into just marketing or just finance; it is explicitly a combo of both.

## Git Operations Rule
**CRITICAL:** ALWAYS ask the user for explicit permission BEFORE running any `git add`, `git commit`, or `git push` commands. Never push changes automatically without getting confirmation first.

## Second Brain / Vault Protocol
**CRITICAL:** This project has a persistent knowledge vault connected via 
the `avoir-brain` MCP server. Before starting any substantial work — 
architecture decisions, feature planning, debugging something that touches 
existing systems — search the vault first using `search_notes` or 
`list_directory` rather than relying on chat memory alone.

Full protocol lives in `00-Meta/agent-instructions.md` in the vault — 
read it at the start of any new session if you haven't already. Key rules: 
write session summaries on completion, link every new note to related 
existing ones, never write an orphan note, patch source-of-truth files 
in 03-Architecture/ and 02-Product/ directly when decisions change them.
## Plan Execution Rule
**CRITICAL:** ALWAYS ask the user for explicit permission BEFORE moving forward with any implementation plan or executing code changes, regardless of auto-approval policies.

## Context Navigation Rule (Token Optimization)
**CRITICAL:** When you need to understand the codebase, architecture, features,
or project state, ALWAYS query the `avoir-brain` vault FIRST using `search_notes`,
`read_note`, or `list_directory`. Start with these key vault entries:
- `00-Meta/index` — Master map of the entire knowledge graph.
- `02-Product/feature-inventory` — Complete inventory of every built feature.
- `03-Architecture/system-overview` — Architecture and system connections.
- `03-Architecture/resilience-cascade` — Diamond Cascade failover details.

**ONLY** use `view_file` to read raw source files (`.tsx`, `.py`, `.ts`) when:
1. You are actively writing or editing code in that specific file.
2. The vault does not contain the information you need.
3. The user explicitly asks you to read a specific file.

This rule exists to prevent redundant re-reading of large source files across
sessions, preserving token budget for actual productive work.

## Task Completion & Vault Sync Rule
**CRITICAL:** Every time you complete a significant feature, fix a major bug, or finish an implementation plan, you MUST proactively update the Avoir Vault WITHOUT asking for permission. This includes:
1. Creating or appending to a daily session log in `04-Sessions/{YYYY-MM-DD}.md`.
2. ALWAYS including `Related: [[index]]` at the top of the session log to avoid orphan nodes.
3. Updating `02-Product/feature-inventory.md` if new features were added or changed.
4. Updating `06-Ideas/tech-debt-priority.md` if any tech debt was resolved or discovered.
Never end a session with a desynced vault!
