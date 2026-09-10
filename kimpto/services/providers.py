"""
Thin wrappers around each vendor's official Python SDK, used only for the
bring-your-own-key path (POST /api/generate, /api/refine, /api/test-run when
the request supplies provider + model + apiKey).

The API key travels with the request body and is used for exactly one
outbound call — it is never written to disk, a database, or a log line.
SDKs are imported lazily inside each function so the app still starts fine
even if a person has trimmed requirements.txt down to only the provider(s)
they actually use.
"""
from __future__ import annotations

from typing import Callable


class ProviderError(RuntimeError):
    """Raised for any failure talking to a provider — bad key, network
    error, rate limit, etc. Routes turn this into a clean 502 JSON error
    instead of leaking a raw SDK traceback to the client."""


def call_claude(api_key: str, model: str, prompt: str, max_tokens: int = 1000) -> str:
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - depends on optional install
        raise ProviderError("The 'anthropic' package isn't installed on the server.") from exc

    client = anthropic.Anthropic(api_key=api_key)
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:  # anthropic raises its own APIError subclasses
        raise ProviderError(str(exc)) from exc

    return "".join(
        block.text for block in resp.content if getattr(block, "type", "") == "text"
    )


def call_openai(api_key: str, model: str, prompt: str, max_tokens: int = 1000) -> str:
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover
        raise ProviderError("The 'openai' package isn't installed on the server.") from exc

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=model,
            max_completion_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        raise ProviderError(str(exc)) from exc

    return resp.choices[0].message.content or ""


def call_gemini(api_key: str, model: str, prompt: str, max_tokens: int = 1000) -> str:
    try:
        from google import genai
    except ImportError as exc:  # pragma: no cover
        raise ProviderError("The 'google-genai' package isn't installed on the server.") from exc

    client = genai.Client(api_key=api_key)
    try:
        resp = client.models.generate_content(model=model, contents=prompt)
    except Exception as exc:
        raise ProviderError(str(exc)) from exc

    return getattr(resp, "text", "") or ""


PROVIDER_CALLERS: dict[str, Callable[[str, str, str, int], str]] = {
    "claude": call_claude,
    "gpt": call_openai,
    "gemini": call_gemini,
}


def call_provider(provider: str, api_key: str, model: str, prompt: str, max_tokens: int = 1000) -> str:
    caller = PROVIDER_CALLERS.get(provider)
    if not caller:
        raise ProviderError(f"Unknown provider: {provider}")
    if not api_key:
        raise ProviderError("Missing API key.")
    if not model:
        raise ProviderError("Missing model.")
    return caller(api_key, model, prompt, max_tokens)
