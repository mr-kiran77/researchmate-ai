"""Unified AI provider wrapper (Gemini Interactions API, OpenAI, and honest fallback)."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class LLMServiceError(RuntimeError):
    """Raised when a live LLM request fails."""


def _strip_json_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


class LLMService:
    """Handles structured and conversational inference via Gemini, OpenAI, or fallback."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def mode(self) -> str:
        return self.settings.active_llm_mode()

    @property
    def engine_label(self) -> str:
        mode = self.mode
        if mode == "gemini":
            return f"Gemini ({self.settings.gemini_model})"
        if mode == "openai":
            return f"OpenAI ({self.settings.openai_model})"
        return "Evidence-Grounded Extractive Synthesizer (No LLM Key Configured)"

    def _gemini_candidate_models(self) -> list[str]:
        candidates = [
            self.settings.gemini_model,
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-3.8-flash",
        ]
        seen: list[str] = []
        for m in candidates:
            m = (m or "").strip()
            if m and m not in seen:
                seen.append(m)
        return seen

    async def generate_structured(
        self,
        *,
        system_instruction: str,
        prompt: str,
        schema_model: Type[T],
        thinking_level: str = "medium",
    ) -> tuple[Optional[T], str]:
        """Generate structured output validated against a Pydantic model.

        Returns (parsed_model_or_None, engine_label_used).
        Never throws for missing keys; falls back cleanly to None so the deterministic
        synthesizer can run transparently.
        """
        mode = self.mode
        if mode == "gemini":
            try:
                parsed, model_used = await asyncio.to_thread(
                    self._gemini_structured_sync,
                    system_instruction,
                    prompt,
                    schema_model,
                    thinking_level,
                )
                return parsed, f"Gemini ({model_used})"
            except Exception as exc:
                logger.warning("Gemini structured call failed, falling back: %s", exc)
                if self.settings.effective_openai_key:
                    try:
                        parsed = await asyncio.to_thread(
                            self._openai_structured_sync,
                            system_instruction,
                            prompt,
                            schema_model,
                        )
                        return parsed, f"OpenAI ({self.settings.openai_model})"
                    except Exception as exc2:
                        logger.warning("OpenAI fallback failed: %s", exc2)
                return None, "Evidence-Grounded Extractive Synthesizer (API fallback)"

        if mode == "openai":
            try:
                parsed = await asyncio.to_thread(
                    self._openai_structured_sync,
                    system_instruction,
                    prompt,
                    schema_model,
                )
                return parsed, f"OpenAI ({self.settings.openai_model})"
            except Exception as exc:
                logger.warning("OpenAI structured call failed, falling back: %s", exc)
                return None, "Evidence-Grounded Extractive Synthesizer (API fallback)"

        return None, self.engine_label

    async def generate_chat_reply(
        self,
        *,
        system_instruction: str,
        prompt: str,
        history: list[dict[str, str]],
        previous_interaction_id: Optional[str] = None,
    ) -> tuple[Optional[str], Optional[str], str]:
        """Generate a conversational answer. Returns (text_or_None, new_interaction_id, engine_label)."""
        mode = self.mode
        if mode == "gemini":
            try:
                text, inter_id, model_used = await asyncio.to_thread(
                    self._gemini_chat_sync,
                    system_instruction,
                    prompt,
                    history,
                    previous_interaction_id,
                )
                return text, inter_id, f"Gemini ({model_used})"
            except Exception as exc:
                logger.warning("Gemini chat failed, falling back: %s", exc)

        if mode == "openai" or (mode == "gemini" and self.settings.effective_openai_key):
            try:
                text = await asyncio.to_thread(
                    self._openai_chat_sync,
                    system_instruction,
                    prompt,
                    history,
                )
                return text, None, f"OpenAI ({self.settings.openai_model})"
            except Exception as exc:
                logger.warning("OpenAI chat failed, falling back: %s", exc)

        return None, None, self.engine_label

    # ------------------------------------------------------------------
    # Provider implementations (Current SDKs)
    # ------------------------------------------------------------------

    def _gemini_client(self):
        from google import genai

        return genai.Client(
            api_key=self.settings.effective_gemini_key,
            http_options={"timeout": 25000, "retry_options": {"attempts": 1}},
        )

    @staticmethod
    def _is_network_unreachable(exc: Exception) -> bool:
        msg = str(exc).lower()
        return any(
            token in msg
            for token in ("getaddrinfo failed", "10051", "11001", "unreachable network", "connecterror")
        )

    def _gemini_structured_sync(
        self,
        system_instruction: str,
        prompt: str,
        schema_model: Type[T],
        thinking_level: str,
    ) -> tuple[T, str]:
        client = self._gemini_client()
        last_exc: Optional[Exception] = None
        for model_name in self._gemini_candidate_models():
            try:
                kwargs: dict = {
                    "model": model_name,
                    "system_instruction": system_instruction,
                    "input": prompt,
                    "response_format": {
                        "type": "text",
                        "mime_type": "application/json",
                        "schema": schema_model.model_json_schema(),
                    },
                }
                if "gemini-3" in model_name or "gemini-4" in model_name:
                    kwargs["generation_config"] = {"thinking_level": thinking_level}

                interaction = client.interactions.create(**kwargs)
                raw_text = _strip_json_fences(interaction.output_text or "")
                return schema_model.model_validate_json(raw_text), model_name
            except Exception as exc:
                last_exc = exc
                logger.warning("Gemini model %s failed (%s)", model_name, exc)
                if self._is_network_unreachable(exc):
                    break
        assert last_exc is not None
        raise last_exc

    def _gemini_chat_sync(
        self,
        system_instruction: str,
        prompt: str,
        history: list[dict[str, str]],
        previous_interaction_id: Optional[str],
    ) -> tuple[str, Optional[str], str]:
        client = self._gemini_client()
        last_exc: Optional[Exception] = None
        for model_name in self._gemini_candidate_models():
            try:
                kwargs: dict = {
                    "model": model_name,
                    "system_instruction": system_instruction,
                    "input": prompt,
                }
                if "gemini-3" in model_name or "gemini-4" in model_name:
                    kwargs["generation_config"] = {"thinking_level": "low"}

                if previous_interaction_id:
                    kwargs["previous_interaction_id"] = previous_interaction_id
                elif history:
                    formatted = "\n".join(
                        f"{m['role'].upper()}: {m['content']}" for m in history[-8:]
                    )
                    kwargs["input"] = f"Conversation so far:\n{formatted}\n\nUSER: {prompt}"

                try:
                    interaction = client.interactions.create(**kwargs)
                except Exception as inner_exc:
                    if previous_interaction_id and not self._is_network_unreachable(inner_exc):
                        kwargs.pop("previous_interaction_id", None)
                        formatted = "\n".join(
                            f"{m['role'].upper()}: {m['content']}" for m in history[-8:]
                        )
                        kwargs["input"] = f"Conversation so far:\n{formatted}\n\nUSER: {prompt}"
                        interaction = client.interactions.create(**kwargs)
                    else:
                        raise
                return (interaction.output_text or "").strip(), getattr(interaction, "id", None), model_name
            except Exception as exc:
                last_exc = exc
                logger.warning("Gemini chat model %s failed (%s)", model_name, exc)
                if self._is_network_unreachable(exc):
                    break
        assert last_exc is not None
        raise last_exc

    def _openai_client(self):
        from openai import OpenAI

        return OpenAI(api_key=self.settings.effective_openai_key)

    def _openai_structured_sync(
        self,
        system_instruction: str,
        prompt: str,
        schema_model: Type[T],
    ) -> T:
        client = self._openai_client()
        schema_json = json.dumps(schema_model.model_json_schema(), indent=2)
        resp = client.chat.completions.create(
            model=self.settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"{system_instruction}\n\n"
                        "Return ONLY valid JSON conforming strictly to this JSON Schema:\n"
                        f"{schema_json}"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        raw_text = _strip_json_fences(resp.choices[0].message.content or "")
        return schema_model.model_validate_json(raw_text)

    def _openai_chat_sync(
        self,
        system_instruction: str,
        prompt: str,
        history: list[dict[str, str]],
    ) -> str:
        client = self._openai_client()
        messages = [{"role": "system", "content": system_instruction}]
        for m in history[-10:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})
        resp = client.chat.completions.create(
            model=self.settings.openai_model,
            messages=messages,
        )
        return (resp.choices[0].message.content or "").strip()
