"""Small, dependency-free client for one Hellominds Builder API turn."""

from __future__ import annotations

import json
import time
import uuid
import urllib.error
import urllib.request

from config import MINDS_API_BASE, MINDS_API_KEY, MINDS_SPARK_ID


class MindsAgentError(RuntimeError):
    """Raised when the configured Mind cannot return a usable answer."""


def minds_is_configured() -> bool:
    return bool(MINDS_API_KEY and MINDS_SPARK_ID)


def _conversation_alias() -> str:
    return f"arcana-{uuid.uuid4().hex}"


def _prompt(message: str, card: dict, locale: str) -> str:
    language = {"zh": "简体中文", "en": "English", "ja": "日本語"}.get(locale, "简体中文")
    return (
        "You are TARO, ARCANA's calm tarot-cat companion. This is one independent turn: "
        "do not assume or invent any earlier conversation. Answer in " + language + ".\n"
        "Extract two to five meaningful keywords from the user's own question. Then interpret the "
        "already-drawn card as a reflective prompt, never as a guaranteed prediction or professional advice.\n"
        "Return ONLY valid JSON with this shape: "
        '{"reply":"...","keywords":["..."],"reading":"..."}\n\n'
        f"User question: {message}\n"
        f"Card: {card.get('name', '')}\n"
        f"Orientation: {card.get('direction', '')}\n"
        f"Card meaning: {card.get('meaning', '')}"
    )


def _request_json(path: str, payload: dict | None = None, timeout: int = 180) -> dict | list:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{MINDS_API_BASE}{path}",
        data=data,
        headers={
            "X-Api-Key": MINDS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="GET" if payload is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _extract_text(history: dict | list) -> str:
    items = history.get("items", history.get("data", [])) if isinstance(history, dict) else history
    if not isinstance(items, list):
        return ""
    for item in reversed(items):
        if not isinstance(item, dict):
            continue
        sender = str(item.get("senderType", item.get("role", item.get("sender", "")))).lower()
        text = item.get("messageText") or item.get("content") or item.get("text") or item.get("message")
        if text and sender not in {"1", "user", "human"}:
            return str(text).strip()
    return ""


def _parse_result(text: str) -> dict:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise MindsAgentError("Mind returned invalid structured output")
        parsed = json.loads(text[start:end + 1])
    if not isinstance(parsed, dict):
        raise MindsAgentError("Mind returned invalid structured output")
    reply = str(parsed.get("reply", "")).strip()
    reading = str(parsed.get("reading", "")).strip()
    keywords = [str(value).strip() for value in parsed.get("keywords", []) if str(value).strip()]
    if not reply or not reading or not keywords:
        raise MindsAgentError("Mind response is incomplete")
    return {"reply": reply, "keywords": keywords[:5], "reading": reading}


def run_mind_single_turn(message: str, card: dict, locale: str = "zh", timeout: int = 180) -> dict:
    """Send exactly one user message to one configured TARO Mind."""
    if not minds_is_configured():
        raise MindsAgentError("MINDS_API_KEY or MINDS_SPARK_ID is not configured")

    alias = _conversation_alias()
    try:
        _request_json(
            "/v1/messaging/conversation",
            {"mindId": MINDS_SPARK_ID, "alias": alias},
            timeout=timeout,
        )
        _request_json(
            "/v1/messaging/message",
            {"alias": alias, "messageText": _prompt(message, card, locale)},
            timeout=timeout,
        )
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            history = _request_json(f"/v1/messaging/histories/{alias}", timeout=timeout)
            text = _extract_text(history)
            if text:
                return _parse_result(text)
            time.sleep(1.2)
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise MindsAgentError("Mind request failed") from error

    raise MindsAgentError("Mind request timed out")
