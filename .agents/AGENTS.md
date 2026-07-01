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