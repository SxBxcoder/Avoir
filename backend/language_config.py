"""
Avoir — Language Configuration
Defines supported languages, locale codes, and prompt modifiers for
multi-language campaign generation.
"""

from enum import Enum
from typing import Dict, Optional


class Language(str, Enum):
    EN = "en"
    HI = "hi"
    HI_EN = "hi-en"
    ES = "es"
    PT = "pt"
    FR = "fr"
    TA = "ta"
    BN = "bn"


LANGUAGE_REGISTRY: Dict[str, Dict[str, str]] = {
    "en": {
        "code": "en",
        "name": "English",
        "native_name": "English",
        "flag": "🇺🇸",
        "script": "latin",
        "prompt_instruction": "Generate all campaign content in English.",
    },
    "hi": {
        "code": "hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "flag": "🇮🇳",
        "script": "devanagari",
        "prompt_instruction": (
            "Generate all campaign content in Hindi using Devanagari script (हिन्दी). "
            "Use natural, conversational Hindi that resonates with Indian social media users. "
            "The hook, offer, CTA, and captions must all be in Hindi."
        ),
    },
    "hi-en": {
        "code": "hi-en",
        "name": "Hinglish",
        "native_name": "Hinglish",
        "flag": "🇮🇳",
        "script": "latin",
        "prompt_instruction": (
            "Generate campaign content in Hinglish — a natural mix of Hindi transliterated "
            "in Latin script and English. Example: 'Arre bhai, ye offer miss mat karo!' "
            "Use casual, street-style Hinglish that Indian Gen-Z and millennials use on "
            "TikTok and Instagram. Do NOT use Devanagari script."
        ),
    },
    "es": {
        "code": "es",
        "name": "Spanish",
        "native_name": "Español",
        "flag": "🇪🇸",
        "script": "latin",
        "prompt_instruction": (
            "Generate all campaign content in Spanish (Español). Use Latin American "
            "Spanish dialect that feels natural for social media. The hook, offer, CTA, "
            "and captions must all be in Spanish."
        ),
    },
    "pt": {
        "code": "pt",
        "name": "Portuguese",
        "native_name": "Português",
        "flag": "🇧🇷",
        "script": "latin",
        "prompt_instruction": (
            "Generate all campaign content in Brazilian Portuguese (Português). "
            "Use casual, modern Brazilian Portuguese suitable for Instagram and TikTok. "
            "The hook, offer, CTA, and captions must all be in Portuguese."
        ),
    },
    "fr": {
        "code": "fr",
        "name": "French",
        "native_name": "Français",
        "flag": "🇫🇷",
        "script": "latin",
        "prompt_instruction": (
            "Generate all campaign content in French (Français). Use modern, casual "
            "French appropriate for social media marketing. The hook, offer, CTA, "
            "and captions must all be in French."
        ),
    },
    "ta": {
        "code": "ta",
        "name": "Tamil",
        "native_name": "தமிழ்",
        "flag": "🇮🇳",
        "script": "tamil",
        "prompt_instruction": (
            "Generate all campaign content in Tamil using Tamil script (தமிழ்). "
            "Use natural, conversational Tamil suitable for social media. "
            "The hook, offer, CTA, and captions must all be in Tamil."
        ),
    },
    "bn": {
        "code": "bn",
        "name": "Bengali",
        "native_name": "বাংলা",
        "flag": "🇧🇩",
        "script": "bengali",
        "prompt_instruction": (
            "Generate all campaign content in Bengali using Bengali script (বাংলা). "
            "Use natural, conversational Bengali suitable for social media. "
            "The hook, offer, CTA, and captions must all be in Bengali."
        ),
    },
}

DEFAULT_LANGUAGE = "en"


def get_language_config(code: str) -> Optional[Dict[str, str]]:
    return LANGUAGE_REGISTRY.get(code.lower().strip())


def get_prompt_instruction(code: str) -> str:
    config = get_language_config(code)
    if not config:
        return LANGUAGE_REGISTRY[DEFAULT_LANGUAGE]["prompt_instruction"]
    return config["prompt_instruction"]


def is_supported(code: str) -> bool:
    return code.lower().strip() in LANGUAGE_REGISTRY


def get_all_languages() -> list:
    return [
        {
            "code": cfg["code"],
            "name": cfg["name"],
            "native_name": cfg["native_name"],
            "flag": cfg["flag"],
        }
        for cfg in LANGUAGE_REGISTRY.values()
    ]


def detect_language_from_text(text: str) -> str:
    text_lower = text.lower()

    devanagari_keywords = ["का", "की", "के", "है", "में", "को", "से", "ने", "पर", "ये", "वो", "आप", "हम", "तुम", "अरे", "भाई", "बहुत", "अच्छा"]
    if any(ch >= '\u0900' and ch <= '\u097F' for ch in text):
        return "hi"

    tamil_keywords = ["அ", "ஆ", "இ", "உ", "எ", "ஒ", "ந", "த", "ம", "வ", "ர", "ல", "க"]
    if any(ch >= '\u0B80' and ch <= '\u0BFF' for ch in text):
        return "ta"

    bengali_keywords = ["অ", "আ", "ই", "উ", "এ", "ও", "ক", "খ", "গ", "চ", "ছ", "জ"]
    if any(ch >= '\u0980' and ch <= '\u09FF' for ch in text):
        return "bn"

    hinglish_markers = ["yaar", "bhai", "arre", "mat", "karo", "hai", "mein", "se", "ko", "nahi", "ekdum", "bindaas", "jugaad", "paisa", "dost"]
    hinglish_count = sum(1 for word in hinglish_markers if word in text_lower)
    if hinglish_count >= 2:
        return "hi-en"

    return DEFAULT_LANGUAGE
