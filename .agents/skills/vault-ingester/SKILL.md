---
name: vault-ingester
description: Automatically run market research scripts, summarize the raw data, and ingest it into the 01-Research folder in the second brain vault.
---

# Vault Ingester Skill

This skill teaches the AI how to act as an automated ingestion pipeline for the `avoir-brain` second brain vault, mimicking the "LLM Wiki" self-organizing architecture.

## Trigger Conditions
Execute this skill when the user runs the `vault-ingester` skill directly, or when scheduled via a cron background task for automated weekly market research.

## Execution Steps

### 1. Execute the Data Gatherer
Run the `backend/trends_sniper.py` script (or equivalent research script) to scrape the latest market trends.
If the script outputs to a JSON or text file, read that file to gather the raw data. 

### 2. Synthesize the Data
Use your own LLM capabilities to synthesize the raw scraped data into a highly structured, readable Markdown report. 
The report should include:
- A high-level summary of the current market state.
- 3-5 specific actionable trends for B2B SaaS or Algorithmic Trading.
- Potential impact on Avoir's core strategies.

### 3. Generate Backlinks (Requires Verification)
Before generating backlinks, use the `avoir-brain` MCP server's `search_notes` or `list_directory` tools to confirm the existence of related concepts. 
**CRITICAL:** Only emit backlinks (e.g., `[[Algorithmic Trading]]`) that resolve to confirmed, existing vault entries. Do not guess or create orphaned links.

### 4. Ingest into the Vault (Draft Gating)
Use the `avoir-brain` MCP server's `write_note` tool to save the synthesized report.
- **CRITICAL:** If running in an automated background task (cron), you must save the report as a draft. 
- Target draft path: `01-Research/Inbox/Draft-Trend-Report-[YYYY-MM-DD].md`
- If running manually with the user present, you may ask for explicit permission to save directly to `01-Research/Synthesized/Trend-Report-[YYYY-MM-DD].md`.

### 5. Report Completion
Once the file is successfully written to the vault's Inbox, notify the user (or log the completion) that a draft is ready for human review. Do not output the entire report into the chat.
