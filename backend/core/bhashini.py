"""
core/bhashini.py — Bhashini API Client (Mock)

This module implements the Bhashini interface for translation and TTS.
As per Option A (Mock), this currently bypasses external API calls and
returns static mock data, allowing the frontend to test TTS playback.
"""

def translate_en_to_hi(text: str) -> str:
    """
    Translates an English string to Hindi.
    (Mock implementation: currently returns the original text, as the
    actual Hindi strings are hardcoded in reason_texts.py for precision).
    """
    # In a real implementation, this would call the Bhashini translate endpoint.
    return text

def generate_tts(text: str, lang: str = "hi") -> str:
    """
    Generates TTS audio for the given text and language.
    Returns a relative URL to the generated audio file.
    
    (Mock implementation: returns a static dummy audio URL).
    """
    # In a real implementation:
    # 1. Call Bhashini TTS endpoint
    # 2. Save the base64 audio to data/audio/{hash}.mp3
    # 3. Return f"/static/audio/{hash}.mp3"
    
    if lang == "hi":
        return "/static/audio/dummy_hi.mp3"
    return "/static/audio/dummy_en.mp3"
