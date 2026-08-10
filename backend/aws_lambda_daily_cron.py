"""
Avoir - Daily Alpha Brief Cron (AWS Lambda)
Scheduled via EventBridge (e.g., cron: 15 0 * * ? *  = 00:15 UTC daily).

Pre-warms today's alpha brief into Upstash Redis so every user request
for the DailyAlphaBrief card hits a cached response (no LLM latency, no
burst of Gemini calls during peak hours).

Usage:
    python aws_lambda_daily_cron.py          # local smoke test

Author: Team NEONX
Project: Avoir - AI-Native Agency + AI Hedge Fund
"""

import json
import logging

from alpha_brief_generator import AlphaBriefGenerator

logger = logging.getLogger()
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger.setLevel(logging.INFO)


def lambda_handler(event, context) -> dict:
    """
    AWS Lambda entry point for the daily cron trigger.

    Args:
        event: EventBridge scheduled event (or any test payload).
        context: Lambda context object.

    Returns:
        API-Gateway-style response with 200/500 status and JSON body.
    """
    try:
        logger.info("[AlphaCron] Firing daily alpha brief generation...")
        brief = AlphaBriefGenerator().get_daily_brief(force_refresh=True)

        logger.info(f"[AlphaCron] Brief cached for {brief.get('date')} "
                    f"via {brief.get('generated_by')}")

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'status': 'success',
                'date': brief.get('date'),
                'trend': (brief.get('trend') or {}).get('title'),
                'generated_by': brief.get('generated_by'),
                'cached': True,
            }),
        }
    except Exception as e:
        logger.error(f"[AlphaCron] FAILED: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'status': 'error', 'error': str(e)}),
        }


if __name__ == "__main__":
    # Local smoke test
    response = lambda_handler({}, None)
    print(json.dumps(response, indent=2))
