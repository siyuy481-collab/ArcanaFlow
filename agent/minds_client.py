"""LangChain adapter for one Hellominds Builder API agent turn."""

from __future__ import annotations

import json
import html
import re
import time
import uuid
import urllib.error
import urllib.request

from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompt_values import PromptValue
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableLambda, RunnablePassthrough
from pydantic import BaseModel, Field, field_validator

from config import MINDS_API_BASE, MINDS_API_KEY, MINDS_SPARK_ID


class MindsAgentError(RuntimeError):
    """Raised when the configured Mind cannot return a usable answer."""


class MindTurnResult(BaseModel):
    """Structured output returned by the TARO Mind LangChain pipeline."""

    reply: str = Field(min_length=1, description="A short, empathetic reply to the user")
    keywords: list[str] = Field(
        min_length=1,
        max_length=5,
        description="Two to five meaningful keywords taken from the user's question",
    )
    reading: str = Field(min_length=1, description="A reflective interpretation of the drawn card")

    @field_validator("reply", "reading", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("keywords", mode="before")
    @classmethod
    def normalize_keywords(cls, value):
        if not isinstance(value, list):
            return value
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return list(dict.fromkeys(cleaned))[:5]


def minds_is_configured() -> bool:
    return bool(MINDS_API_KEY and MINDS_SPARK_ID)


def _conversation_alias() -> str:
    return f"arcana-{uuid.uuid4().hex}"


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


mind_output_parser = PydanticOutputParser(pydantic_object=MindTurnResult)
mind_prompt = PromptTemplate.from_template(
    """You are TARO, ARCANA's calm tarot-cat companion. This is one independent turn:
do not assume or invent any earlier conversation. Answer in {language}.
Extract two to five meaningful keywords from the user's own question. Then interpret the
already-drawn card as a reflective prompt, never as a guaranteed prediction or professional advice.
Return ONLY valid JSON that follows this schema:
{format_instructions}

User question: {message}
Card: {card_name}
Orientation: {card_direction}
Card meaning: {card_meaning}"""
).partial(format_instructions=mind_output_parser.get_format_instructions())


def _invoke_minds_transport(values: dict) -> str:
    """Execute the provider-specific REST calls inside a LangChain Runnable."""
    prompt_value = values.get("prompt")
    if not isinstance(prompt_value, PromptValue):
        raise MindsAgentError("Mind prompt could not be rendered")

    timeout = int(values.get("timeout", 180))
    alias = _conversation_alias()
    try:
        _request_json(
            "/v1/messaging/conversation",
            {"mindId": MINDS_SPARK_ID, "alias": alias},
            timeout=timeout,
        )
        _request_json(
            "/v1/messaging/message",
            {"alias": alias, "messageText": prompt_value.to_string()},
            timeout=timeout,
        )
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            history = _request_json(f"/v1/messaging/histories/{alias}", timeout=timeout)
            text = _extract_text(history)
            if text:
                return text
            time.sleep(1.2)
    except MindsAgentError:
        raise
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise MindsAgentError("Mind request failed") from error

    raise MindsAgentError("Mind request timed out")


def _extract_structured_output(text: str) -> str:
    """Normalize Minds' rich-text response into the JSON payload requested in the prompt."""
    if not isinstance(text, str):
        raise OutputParserException("Mind returned a non-text response")

    stripped = text.strip()
    pre_match = re.search(r"<pre[^>]*>(.*?)</pre>", stripped, flags=re.IGNORECASE | re.DOTALL)
    if pre_match:
        stripped = pre_match.group(1).strip()
    elif "<" in stripped and ">" in stripped:
        stripped = re.sub(r"<[^>]+>", "", stripped).strip()

    stripped = html.unescape(stripped)
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        return stripped[start : end + 1].strip()
    return stripped


mind_chain = (
    RunnablePassthrough.assign(prompt=mind_prompt)
    | RunnableLambda(_invoke_minds_transport, name="MindsBuilderTransport")
    | RunnableLambda(_extract_structured_output, name="MindsStructuredOutputExtractor")
    | mind_output_parser
).with_config({"run_name": "arcana_minds_single_turn"})


def run_mind_single_turn(message: str, card: dict, locale: str = "zh", timeout: int = 180) -> dict:
    """Invoke the LangChain-managed TARO Mind pipeline for one stateless turn."""
    if not minds_is_configured():
        raise MindsAgentError("MINDS_BUILDER_API_KEY or MINDS_SPARK_ID is not configured")

    language = {"zh": "简体中文", "en": "English", "ja": "日本語"}.get(locale, "简体中文")
    try:
        parsed = mind_chain.invoke({
            "message": message.strip(),
            "language": language,
            "card_name": card.get("name", ""),
            "card_direction": card.get("direction", ""),
            "card_meaning": card.get("meaning", ""),
            "timeout": timeout,
        })
    except MindsAgentError:
        raise
    except (OutputParserException, TypeError, ValueError) as error:
        raise MindsAgentError("Mind returned invalid structured output") from error
    return parsed.model_dump()
