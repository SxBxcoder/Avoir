# Daily Alpha Brief — Cron Runbook

How the daily brief is generated automatically, and how to wire it up in AWS.

## Architecture

```
EventBridge rule  cron(15 0 * * ? *)      (00:15 UTC daily)
        │
        ▼
Lambda  avoir-alpha-brief-cron            backend/aws_lambda_daily_cron.py
        │   AlphaBriefGenerator().get_daily_brief(force_refresh=True)
        ▼
Upstash Redis  alpha_brief:daily:<date>   (24h TTL, stampede lock)
        │
        ▼
GET /api/alpha-brief  (Next.js route)     cache hit → instant, no LLM cost
        │
        ▼
DailyAlphaBrief UI card
```

The generator and Redis caching already live in the codebase
(`backend/alpha_brief_generator.py`, merged in PR #11). What this runbook adds
is the **AWS wiring** — Lambda + EventBridge schedule — via one idempotent
script: `scripts/setup-alpha-brief-cron.sh`.

## One-time setup

Prerequisites: AWS CLI configured with an account that can create IAM roles,
Lambda functions and EventBridge rules; Python 3.12; `zip`.

```bash
export UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="AXX..."
export GEMINI_API_KEY="AIza..."          # primary
export GEMINI_API_KEY_2="AIza..."        # optional rotation key

bash scripts/setup-alpha-brief-cron.sh --invoke
```

`--invoke` fires a manual test run at the end. Safe to re-run any time — the
script updates the function in place and never deletes anything.

### Flags

| Flag | Default | Purpose |
|---|---|---|
| `--schedule` | `cron(15 0 * * ? *)` | 00:15 UTC daily |
| `--function-name` | `avoir-alpha-brief-cron` | Lambda name |
| `--region` | `$AWS_REGION` / `us-east-1` | Deployment region |
| `--timeout` | `180`s | Covers Gemini retries + 30s lock waiter |
| `--no-env` | off | Skip copying env vars from your shell |
| `--dry-run` | off | Print planned actions only |

## Verify it works

```bash
# 1. Manual invoke — expect statusCode 200 and "cached": true
aws lambda invoke --function-name avoir-alpha-brief-cron \
  --payload '{}' --region us-east-1 out.json && cat out.json

# 2. Check the cached brief is served by the API
curl https://<your-app>/api/alpha-brief | jq '.generated_by'

# 3. Logs (14-day retention is configured automatically)
aws logs tail /aws/lambda/avoir-alpha-brief-cron --follow
```

## Behavior notes

- **Graceful degradation**: if Upstash/Gemini env vars are missing or calls
  fail, the generator falls back to Trend Sniper → mock data. The cron still
  succeeds; check `generated_by` in the response to see which tier ran.
- **Stampede protection**: concurrent generations share one LLM call via a
  Redis lock (`SET NX` + compare-and-delete release).
- **Cost**: ~1 invocation/day, 256 MB, PAY_PER_REQUEST Redis — effectively free.
- **Code updates**: CI (`deploy-backend.yml`) only updates the API Lambda.
  After changing cron-related backend code, re-run the setup script (or add a
  second `update-function-code` step for the cron function).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `"generated_by": "mock"` | Missing/invalid `GEMINI_API_KEY` | Re-run script with env vars set |
| `statusCode: 500`, `UPSTASH` errors in logs | Wrong Redis URL/token | Verify Upstash REST credentials |
| Brief never refreshes | Rule disabled | `aws events enable-rule --name avoir-alpha-brief-daily` |
| `ResourceConflictException` on re-run | Permission already exists | Harmless — script detects and skips |
