"""
Avoir — Prompt Builder
Constructs language-aware prompts for campaign generation.
"""

from prompts.base import SYSTEM_PROMPT_TEMPLATE, TREND_SNIPER_TEMPLATE
from language_config import get_language_config, DEFAULT_LANGUAGE


def build_system_prompt(language: str = DEFAULT_LANGUAGE) -> str:
    config = get_language_config(language)
    if not config:
        config = get_language_config(DEFAULT_LANGUAGE)

    return SYSTEM_PROMPT_TEMPLATE.format(
        language_instruction=config["prompt_instruction"],
        lang_name=config["name"],
    )


def build_trend_prompt(language: str = DEFAULT_LANGUAGE) -> str:
    config = get_language_config(language)
    if not config:
        config = get_language_config(DEFAULT_LANGUAGE)

    return TREND_SNIPER_TEMPLATE.format(
        language_instruction=config["prompt_instruction"],
        lang_name=config["name"],
    )


def get_language_suffix(language: str) -> str:
    config = get_language_config(language)
    if not config or language == DEFAULT_LANGUAGE:
        return ""
    return f"\n\nIMPORTANT: All user-facing text (hook, offer, cta, captions) MUST be in {config['name']}. Do not output English for these fields."
