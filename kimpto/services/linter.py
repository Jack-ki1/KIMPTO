"""
Heuristic, offline prompt-quality scoring — no model call needed.

This is intentionally simple pattern-matching, not an LLM judge: it exists to
give an instant, free, zero-latency signal while browsing generated prompts.
static/js/catalog.js contains an identical implementation so the browser can
score a prompt the moment it's rendered, without a network round trip; this
Python copy is the one exercised by the test suite and by POST /api/lint,
which the frontend can optionally call to double check its own scoring.
"""
from __future__ import annotations

import re

_VAGUE_RE = re.compile(r"\b(something|stuff|maybe|kind of|sort of|etc\.?)\b", re.I)
_FORMAT_RE = re.compile(r"(format|json|bullet|steps|numbered|markdown|schema)", re.I)
_CONSTRAINT_RE = re.compile(r"(must|only|do not|don't|avoid|no more than|limit|exactly|maximum)", re.I)
_PERSONA_RE = re.compile(r"(you are|as a|acting as)", re.I)


def lint_prompt(text: str) -> dict:
    text = text or ""
    words = text.strip().split()
    word_count = len(words)

    checks = {
        "format": bool(_FORMAT_RE.search(text)),
        "constraints": bool(_CONSTRAINT_RE.search(text)),
        "persona": bool(_PERSONA_RE.search(text)),
        "length": word_count >= 12,
    }
    has_vague = bool(_VAGUE_RE.search(text))

    score = 40
    if checks["length"]:
        score += 10
    if word_count > 30:
        score += 5
    if checks["format"]:
        score += 15
    if checks["constraints"]:
        score += 15
    if checks["persona"]:
        score += 10
    score += -15 if has_vague else 5
    score = max(5, min(100, score))

    tips = []
    if not checks["format"]:
        tips.append("No explicit output format — the model may drift between plain text and lists across runs.")
    if not checks["constraints"]:
        tips.append("No hard constraints (length, scope) — output length may vary run to run.")
    if has_vague:
        tips.append("Contains vague hedge words.")
    if not checks["length"]:
        tips.append("Very short — may be under-specified.")
    if not tips:
        tips.append("Solid structure — has a clear format and constraints.")

    return {"score": score, "wordCount": word_count, "tips": tips, "checks": checks}
