"""Rule-based check for messages that need urgent care rather than a chat answer."""
import re

EMERGENCY_NUMBERS = "your local emergency number (112 in India and Europe, 911 in the US)"

SELF_HARM = re.compile(
    r"\b(kill(ing)? myself|suicid\w*|end(ing)? my life|want to die|self[- ]?harm|hurt(ing)? myself|take my (own )?life)\b",
    re.I,
)
EMERGENCY_SYMPTOMS = re.compile(
    r"\b(chest (pain|pressure|tightness)|crushing chest|heart attack|"
    r"can'?t breathe|cannot breathe|difficulty breathing|trouble breathing|struggling to breathe|"
    r"face (is )?droop\w*|slurred speech|stroke|one side of (my|the) (body|face) (is )?(numb|weak)|"
    r"unconscious|passed out|unresponsive|seizure|fitting|"
    r"throat (is )?(swelling|closing)|anaphyla\w*|coughing (up )?blood|vomiting blood)\b",
    re.I,
)
GLUCOSE_WORDS = re.compile(r"\b(sugar|glucose|bg|bsl|blood sugar|reading|cbg|fbs|rbs)\b", re.I)
NUMBER = re.compile(r"(?<![\d.])(\d{1,3}(?:\.\d+)?)(?![\d./])")
BP = re.compile(r"\b(\d{2,3})\s*/\s*(\d{2,3})\b")


def _glucose_alarm(message: str) -> str | None:
    if not GLUCOSE_WORDS.search(message):
        return None
    says_mmol = "mmol" in message.lower()
    for raw in NUMBER.findall(message):
        value = float(raw)
        if value >= 35:
            mg_dl = value
        elif "." in raw or says_mmol:
            mg_dl = value * 18.0182
        else:
            continue  # small whole numbers are usually counts or times, not readings
        if mg_dl < 1:
            continue
        if mg_dl < 54:
            return "low"
        if mg_dl > 400:
            return "high"
    return None


def _bp_alarm(message: str) -> bool:
    for systolic, diastolic in BP.findall(message):
        s, d = int(systolic), int(diastolic)
        if s > d and (s >= 180 or d >= 120):
            return True
    return False


def triage(message: str) -> str | None:
    """Return an urgent-care reply when the message describes an emergency, else None."""
    if SELF_HARM.search(message):
        return (
            "**I'm really sorry you're feeling this way. You don't have to face it alone.**\n\n"
            "Please reach out right now:\n"
            "- **India:** Tele-MANAS **14416** (free, 24/7)\n"
            "- **US:** call or text **988**\n"
            f"- If you are in immediate danger, call {EMERGENCY_NUMBERS}.\n\n"
            "If you can, tell someone you trust how you're feeling and stay with them."
        )
    if EMERGENCY_SYMPTOMS.search(message):
        return (
            "**This could be a medical emergency.**\n\n"
            f"Please call {EMERGENCY_NUMBERS} or go to the nearest emergency department now. "
            "Don't drive yourself if you feel unwell.\n\n"
            "I can help explain your records once you're safe, but I can't assess symptoms like these."
        )
    glucose = _glucose_alarm(message)
    if glucose == "low":
        return (
            "**That blood sugar is dangerously low.**\n\n"
            "- If you're awake and can swallow, take 15–20 g of fast sugar now (glucose tablets, ½ cup juice or regular soft drink).\n"
            "- Recheck in 15 minutes and repeat if it's still low.\n"
            f"- If you feel confused, drowsy or can't swallow, call {EMERGENCY_NUMBERS} or ask someone to help.\n\n"
            "Let your doctor know about this low."
        )
    if glucose == "high":
        return (
            "**That blood sugar is very high.**\n\n"
            "Recheck it. If it stays above 400 mg/dL (22 mmol/L), or you have vomiting, stomach pain, deep or fast "
            f"breathing, confusion or extreme thirst, seek urgent care or call {EMERGENCY_NUMBERS}.\n\n"
            "Otherwise, contact your doctor today for advice."
        )
    if _bp_alarm(message):
        return (
            "**That blood pressure is in the crisis range (180/120 or higher).**\n\n"
            "Sit quietly for 5 minutes and measure again. If it's still that high, or you have chest pain, "
            "shortness of breath, back pain, numbness, weakness, vision changes or difficulty speaking, "
            f"call {EMERGENCY_NUMBERS} now.\n\n"
            "If you feel fine, contact your doctor today."
        )
    return None
