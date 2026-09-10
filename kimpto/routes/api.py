from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services import linter, prompt_engine, providers
from ..services.models_catalog import BYOK_MODELS, FREE_MODEL_COUNT, FREE_MODEL_GROUPS

bp = Blueprint("api", __name__, url_prefix="/api")


def _convention_for(provider: str) -> str:
    return provider if provider in prompt_engine.CONVENTION_INSTRUCTIONS else "universal"


@bp.get("/techniques")
def techniques():
    """Canonical technique catalog. The browser fetches this once and uses
    it both to render the Settings picker and to build free-tier prompts
    client-side (see static/js/catalog.js)."""
    return jsonify({"techniques": prompt_engine.techniques_json()})


@bp.get("/models")
def models():
    return jsonify(
        {
            "free": FREE_MODEL_GROUPS,
            "freeCount": FREE_MODEL_COUNT,
            "byok": BYOK_MODELS,
            "conventions": prompt_engine.CONVENTION_META,
        }
    )


@bp.post("/lint")
def lint():
    data = request.get_json(force=True, silent=True) or {}
    return jsonify(linter.lint_prompt(data.get("text", "")))


@bp.post("/generate")
def generate():
    """Bring-your-own-key generation. Free-tier generation happens entirely
    client-side via Puter.js and never reaches this route — see
    static/js/api.js."""
    data = request.get_json(force=True, silent=True) or {}

    task = (data.get("task") or "").strip()
    if not task:
        return jsonify({"error": "Task is required."}), 400

    provider = data.get("provider")
    model = data.get("model")
    api_key = data.get("apiKey")
    technique_ids = data.get("techniques") or ["direct", "role"]
    settings = data.get("settings") or {}
    details = data.get("details") or {}

    bad_ids = [t for t in technique_ids if t not in prompt_engine.TECHNIQUES_BY_ID]
    if bad_ids:
        return jsonify({"error": f"Unknown technique(s): {', '.join(bad_ids)}"}), 400
    if provider not in providers.PROVIDER_CALLERS:
        return jsonify({"error": f"Unknown provider: {provider}"}), 400
    if not api_key:
        return jsonify({"error": "An API key is required for bring-your-own-key generation."}), 400

    convention = _convention_for(provider)
    user_msg = prompt_engine.build_user_message(
        task,
        details.get("role", ""),
        details.get("audience", ""),
        details.get("format", ""),
        details.get("constraints", ""),
    )

    merged: dict = {}
    # Chunk into groups of 3 techniques per call to stay under a safe token
    # budget regardless of how many techniques were selected.
    for i in range(0, len(technique_ids), 3):
        chunk = technique_ids[i : i + 3]
        system_prompt = prompt_engine.build_system_prompt(chunk, settings, convention)
        try:
            raw = providers.call_provider(
                provider, api_key, model, system_prompt + "\n\n---\n\n" + user_msg, max_tokens=1200
            )
            merged.update(prompt_engine.extract_json(raw))
        except providers.ProviderError as exc:
            return jsonify({"error": str(exc)}), 502
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 502

    for tid, entry in merged.items():
        entry["lint"] = linter.lint_prompt(entry.get("prompt", ""))

    return jsonify({"results": merged, "convention": convention})


@bp.post("/refine")
def refine():
    data = request.get_json(force=True, silent=True) or {}

    current_prompt = (data.get("prompt") or "").strip()
    instruction = (data.get("instruction") or "").strip()
    provider = data.get("provider")
    model = data.get("model")
    api_key = data.get("apiKey")
    settings = data.get("settings") or {}

    if not current_prompt or not instruction:
        return jsonify({"error": "Both the current prompt and an instruction are required."}), 400
    if provider not in providers.PROVIDER_CALLERS:
        return jsonify({"error": f"Unknown provider: {provider}"}), 400
    if not api_key:
        return jsonify({"error": "An API key is required for bring-your-own-key refine."}), 400

    convention = _convention_for(provider)
    system_prompt = prompt_engine.build_refine_prompt(current_prompt, instruction, settings, convention)

    try:
        raw = providers.call_provider(provider, api_key, model, system_prompt, max_tokens=1000)
        parsed = prompt_engine.extract_json(raw)
    except providers.ProviderError as exc:
        return jsonify({"error": str(exc)}), 502
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 502

    parsed["lint"] = linter.lint_prompt(parsed.get("prompt", ""))
    return jsonify(parsed)


@bp.post("/test-run")
def test_run():
    data = request.get_json(force=True, silent=True) or {}

    prompt_text = (data.get("prompt") or "").strip()
    sample_input = (data.get("input") or "Respond to the instructions above using a realistic example.").strip()
    provider = data.get("provider")
    model = data.get("model")
    api_key = data.get("apiKey")

    if not prompt_text:
        return jsonify({"error": "A prompt is required."}), 400
    if provider not in providers.PROVIDER_CALLERS:
        return jsonify({"error": f"Unknown provider: {provider}"}), 400
    if not api_key:
        return jsonify({"error": "An API key is required to test-run with your own key."}), 400

    try:
        out = providers.call_provider(
            provider, api_key, model, prompt_text + "\n\n---\n\nUser input:\n" + sample_input, max_tokens=1000
        )
    except providers.ProviderError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"output": out})
