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

### 3. Generate Backlinks
Ensure the generated report includes Obsidian-style backlinks to core concepts that likely exist in the vault. 
Examples: `[[Algorithmic Trading]]`, `[[B2B SaaS]]`, `[[Market Anomalies]]`.

### 4. Ingest into the Vault
Use the `avoir-brain` MCP server's `write_note` tool to save the synthesized report.
- Target path: `01-Research/Synthesized/Trend-Report-[YYYY-MM-DD].md`
- Do NOT save this locally in the standard repo directory; it must be written into the vault via the MCP tool.

### 5. Report Completion
Once the file is successfully written to the vault, notify the user (or simply log the completion if running in the background) that the ingest pipeline ran successfully. Do not output the entire report into the chat, just provide a summary and the vault path.
