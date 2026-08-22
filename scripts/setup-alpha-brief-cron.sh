#!/usr/bin/env bash
# ============================================================================
# Avoir — Daily Alpha Brief Cron Provisioner (one-time, idempotent)
# ============================================================================
# Wires the already-merged cron code into AWS:
#
#   EventBridge rule (cron(15 0 * * ? *)) ──▶ Lambda avoir-alpha-brief-cron
#                                               └─ aws_lambda_daily_cron.py
#                                                    └─ AlphaBriefGenerator
#                                                         └─ Upstash Redis
#
# Safe to re-run: every step is create-or-update. Nothing is deleted.
#
# Usage:
#   export UPSTASH_REDIS_REST_URL=https://... UPSTASH_REDIS_REST_TOKEN=...
#   export GEMINI_API_KEY=...                # GEMINI_API_KEY_2 optional
#   bash scripts/setup-alpha-brief-cron.sh [--dry-run] [--invoke] [flags]
#
# Flags:
#   --function-name NAME   (default avoir-alpha-brief-cron)
#   --rule-name NAME       (default avoir-alpha-brief-daily)
#   --schedule EXPR        (default "cron(15 0 * * ? *)" = 00:15 UTC daily)
#   --region REGION        (default $AWS_REGION or us-east-1)
#   --timeout SECONDS      (default 180)
#   --memory MB            (default 256)
#   --log-retention DAYS   (default 14)
#   --zip-file PATH        reuse a prebuilt deployment zip instead of building
#   --no-env               do NOT copy UPSTASH/GEMINI vars from this shell
#                          onto the Lambda (configure them yourself later)
#   --dry-run              print planned actions only
#   --invoke               fire a manual test invocation at the end
# ============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Defaults
# ----------------------------------------------------------------------------
FUNCTION_NAME="avoir-alpha-brief-cron"
RULE_NAME="avoir-alpha-brief-daily"
SCHEDULE='cron(15 0 * * ? *)'
REGION="${AWS_REGION:-us-east-1}"
TIMEOUT=180
MEMORY=256
LOG_RETENTION=14
ZIP_FILE=""
COPY_ENV=1
DRY_RUN=0
INVOKE=0
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --function-name) FUNCTION_NAME="$2"; shift 2 ;;
    --rule-name)     RULE_NAME="$2"; shift 2 ;;
    --schedule)      SCHEDULE="$2"; shift 2 ;;
    --region)        REGION="$2"; shift 2 ;;
    --timeout)       TIMEOUT="$2"; shift 2 ;;
    --memory)        MEMORY="$2"; shift 2 ;;
    --log-retention) LOG_RETENTION="$2"; shift 2 ;;
    --zip-file)      ZIP_FILE="$2"; shift 2 ;;
    --no-env)        COPY_ENV=0; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --invoke)        INVOKE=1; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

ROLE_NAME="${FUNCTION_NAME}-role"
LOG_GROUP="/aws/lambda/${FUNCTION_NAME}"
TARGET_ID="alpha-brief"

say()  { printf '   %s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then say "[dry-run] $*"; else "$@"; fi
}

# ----------------------------------------------------------------------------
# Preflight
# ----------------------------------------------------------------------------
step "Preflight"
command -v aws >/dev/null || { echo "AWS CLI not found" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 not found" >&2; exit 1; }
export AWS_PAGER=""
CALLER="$(aws sts get-caller-identity --region "$REGION" --query Account --output text)"
say "Account: ${CALLER} | Region: ${REGION}"

if [[ "$COPY_ENV" == "1" && "$DRY_RUN" != "1" ]]; then
  MISSING=0
  for v in UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN GEMINI_API_KEY; do
    [[ -n "${!v:-}" ]] || { say "WARNING: \$$v is empty — brief will fall back to mock data"; MISSING=1; }
  done
fi

# ----------------------------------------------------------------------------
# Build deployment zip (same recipe as .github/workflows/deploy-backend.yml)
# ----------------------------------------------------------------------------
if [[ -z "$ZIP_FILE" ]]; then
  step "Building deployment package"
  BUILD_DIR="$(mktemp -d)"
  ZIP_FILE="${BUILD_DIR}/alpha-brief-cron.zip"
  pip install -q -r "${REPO_ROOT}/backend/requirements-lambda.txt" -t "${BUILD_DIR}/package"
  cp "${REPO_ROOT}"/backend/*.py "${BUILD_DIR}/package/"
  rm -f "${BUILD_DIR}"/package/test_*.py
  (cd "${BUILD_DIR}/package" && zip -qr "$ZIP_FILE" .)
  rm -rf "${BUILD_DIR}/package"
  say "Package: ${ZIP_FILE} ($(du -h "$ZIP_FILE" | cut -f1))"
else
  step "Using prebuilt package: ${ZIP_FILE}"
  [[ -f "$ZIP_FILE" ]] || { echo "zip not found: $ZIP_FILE" >&2; exit 1; }
fi

# ----------------------------------------------------------------------------
# IAM role (trusts lambda.amazonaws.com, CloudWatch Logs via AWS managed policy)
# ----------------------------------------------------------------------------
step "IAM role: ${ROLE_NAME}"
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  say "Role exists — reusing"
else
  run aws iam create-role --role-name "$ROLE_NAME" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --description "Avoir daily alpha brief cron" --output none
  run aws iam attach-role-policy --role-name "$ROLE_NAME" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  say "Role created + AWSLambdaBasicExecutionRole attached"
  [[ "$DRY_RUN" == "1" ]] || { say "Waiting for role propagation..."; sleep 10; }
fi
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)"
say "Role ARN: ${ROLE_ARN}"

# ----------------------------------------------------------------------------
# Lambda function (create or update — never delete)
# ----------------------------------------------------------------------------
step "Lambda function: ${FUNCTION_NAME}"
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  say "Function exists — updating code + config"
  run aws lambda update-function-code --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://${ZIP_FILE}" --region "$REGION" --output none
  ENV_ARGS=()
  if [[ "$COPY_ENV" == "1" ]]; then
    ENV_JSON="$(UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-}" \
               UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-}" \
               GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
               GEMINI_API_KEY_2="${GEMINI_API_KEY_2:-}" \
               python3 -c 'import json,os; print(json.dumps({"Variables": {k:v for k,v in os.environ.items() if k.startswith(("UPSTASH","GEMINI")) and v}}))')"
    ENV_ARGS=(--environment "${ENV_JSON}")
  fi
  run aws lambda update-function-configuration --function-name "$FUNCTION_NAME" \
      --handler aws_lambda_daily_cron.lambda_handler --runtime python3.12 \
      --timeout "$TIMEOUT" --memory-size "$MEMORY" \
      "${ENV_ARGS[@]}" --region "$REGION" --output none
  [[ "$DRY_RUN" == "1" ]] || aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" --region "$REGION"
else
  say "Function missing — creating"
  CREATE_ENV_ARGS=()
  if [[ "$COPY_ENV" == "1" ]]; then
    ENV_JSON="$(UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-}" \
               UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-}" \
               GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
               GEMINI_API_KEY_2="${GEMINI_API_KEY_2:-}" \
               python3 -c 'import json,os; print(json.dumps({"Variables": {k:v for k,v in os.environ.items() if k.startswith(("UPSTASH","GEMINI")) and v}}))')"
    CREATE_ENV_ARGS=(--environment "${ENV_JSON}")
  fi
  run aws lambda create-function --function-name "$FUNCTION_NAME" \
      --runtime python3.12 --handler aws_lambda_daily_cron.lambda_handler \
      --role "$ROLE_ARN" --zip-file "fileb://${ZIP_FILE}" \
      --timeout "$TIMEOUT" --memory-size "$MEMORY" \
      "${CREATE_ENV_ARGS[@]}" \
      --description "Daily alpha brief pre-warm (EventBridge scheduled)" \
      --region "$REGION" --output none
  [[ "$DRY_RUN" == "1" ]] || aws lambda wait function-active \
      --function-name "$FUNCTION_NAME" --region "$REGION"
fi

# ----------------------------------------------------------------------------
# EventBridge rule + target + invoke permission
# ----------------------------------------------------------------------------
step "EventBridge rule: ${RULE_NAME} (${SCHEDULE})"
run aws events put-rule --name "$RULE_NAME" --schedule-expression "$SCHEDULE" \
    --state ENABLED --description "Daily alpha brief pre-warm" --region "$REGION" --output none
RULE_ARN="$(aws events describe-rule --name "$RULE_NAME" --region "$REGION" --query Arn --output text)"
FN_ARN="$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query Configuration.FunctionArn --output text)"
say "Rule ARN: ${RULE_ARN}"
say "Target  : ${FN_ARN}"

EXISTING_TARGETS="$(aws events list-targets-by-rule --rule "$RULE_NAME" --region "$REGION" --query 'length(Targets)' --output text 2>/dev/null || echo 0)"
if [[ "$EXISTING_TARGETS" != "0" ]]; then
  run aws events remove-targets --rule "$RULE_NAME" --ids "$TARGET_ID" --region "$REGION" --output none
fi
run aws events put-targets --rule "$RULE_NAME" \
    --targets "Id=${TARGET_ID},Arn=${FN_ARN}" --region "$REGION" --output none

step "Invoke permission for EventBridge"
if aws lambda get-policy --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null \
     | grep -q '"Sid": "eventbridge-invoke"'; then
  say "Permission already granted"
else
  run aws lambda add-permission --function-name "$FUNCTION_NAME" \
      --statement-id eventbridge-invoke --action lambda:InvokeFunction \
      --principal events.amazonaws.com --source-arn "$RULE_ARN" \
      --region "$REGION" --output none
  say "Permission granted"
fi

# ----------------------------------------------------------------------------
# Log retention
# ----------------------------------------------------------------------------
step "Log retention: ${LOG_GROUP} (${LOG_RETENTION}d)"
run aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION" 2>/dev/null || true
run aws logs put-retention-policy --log-group-name "$LOG_GROUP" \
    --retention-in-days "$LOG_RETENTION" --region "$REGION"

# ----------------------------------------------------------------------------
# Optional smoke invocation
# ----------------------------------------------------------------------------
if [[ "$INVOKE" == "1" ]]; then
  step "Test invocation"
  TMP_OUT="$(mktemp)"
  run aws lambda invoke --function-name "$FUNCTION_NAME" --payload '{}' \
      --region "$REGION" --cli-binary-format raw-in-base64-out "$TMP_OUT" >/dev/null
  [[ "$DRY_RUN" == "1" ]] || cat "$TMP_OUT"
  rm -f "$TMP_OUT"
fi

step "Done"
cat <<SUMMARY

   Function : ${FUNCTION_NAME}
   Schedule : ${SCHEDULE} (00:15 UTC daily)
   Rule     : ${RULE_NAME}
   Region   : ${REGION}

   Verify anytime:
     aws lambda invoke --function-name ${FUNCTION_NAME} --payload '{}' \\
       --region ${REGION} out.json && cat out.json
   Re-run this script safely after code changes — it updates in place.
SUMMARY
