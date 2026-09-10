"""
Core prompt-engineering logic for Kimpto.

This module is the single source of truth for:
  - the six prompt-engineering techniques Kimpto knows how to generate
  - the vendor-specific formatting conventions (Claude / GPT / Gemini / Universal)
  - how a system/user message is assembled for a generate or refine call

Both the Flask backend (bring-your-own-key generation, in routes/api.py) and
the browser (free-tier generation via Puter.js, in static/js/catalog.js)
need this data. Rather than hand-duplicating it in JavaScript, the browser
fetches it once from GET /api/techniques and GET /api/models and formats the
same template strings client-side. Keep this file as the only place
technique wording is authored — static/js/catalog.js just consumes it.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

LENGTH_WORDS = {"short": 30, "standard": 55, "long": 95}


@dataclass(frozen=True)
class Technique:
    id: str
    label: str
    principle: str
    short: str
    # Contains a literal "{words}" placeholder filled in with an integer
    # word-count target once the requested length setting is known.
    instruction_template: str

    def instruction(self, base_words: int) -> str:
        return self.instruction_template.format(words=base_words)


TECHNIQUES: list[Technique] = [
    Technique(
        id="direct",
        label="Direct & Concise",
        principle="RTF pattern",
        short="One imperative instruction. Role → Task → Format, nothing else.",
        instruction_template=(
            'Key "direct" — Direct & Concise: a single pure imperative instruction '
            "following Role→Task→Format. Hard ceiling of {words} words. FORBIDDEN: "
            "persona assignment, numbered steps, examples, background context."
        ),
    ),
    Technique(
        id="role",
        label="Role-Based & Detailed",
        principle="Persona framing",
        short="Expert persona, numbered steps, explicit output format.",
        instruction_template=(
            'Key "role" — Role-Based & Detailed: open by assigning a specific expert '
            'persona ("You are a..."), include a numbered breakdown of at least 3 '
            "steps, and specify an explicit output format. Target roughly {words} words."
        ),
    ),
    Technique(
        id="fewshot",
        label="Creative & Few-Shot",
        principle="Few-shot examples",
        short="A {{variable}} placeholder plus one input→output example pair.",
        instruction_template=(
            'Key "fewshot" — Creative & Few-Shot: include at least one {{variable}} '
            'placeholder and one short worked example ("Input: ... -> Output: ..."), '
            "reframing the task from a fresh angle. Target roughly {words} words."
        ),
    ),
    Technique(
        id="cot",
        label="Chain-of-Thought",
        principle="Wei et al., reasoning",
        short="Instructs step-by-step reasoning before the final answer.",
        instruction_template=(
            'Key "cot" — Chain-of-Thought: explicitly instruct the model to reason '
            "step-by-step internally before giving a final answer, and state whether "
            "the reasoning should be shown or hidden. Target roughly {words} words."
        ),
    ),
    Technique(
        id="structured",
        label="Structured Output",
        principle="Schema pinning",
        short="Pins the response to an explicit schema for reliable parsing.",
        instruction_template=(
            'Key "structured" — Structured Output: pin the response to an explicit '
            "schema (JSON keys with types, or a fixed Markdown structure) written out "
            "inline. Target roughly {words} words."
        ),
    ),
    Technique(
        id="metaprompt",
        label="Meta-Prompt",
        principle="Self-refine / Reflexion",
        short="Asks the model to draft, critique, then refine its own approach.",
        instruction_template=(
            'Key "metaprompt" — Meta-Prompt: instruct the model to silently draft an '
            "approach, critique it against the task's goals, then produce only the "
            "refined final instruction. Target roughly {words} words."
        ),
    ),
]

TECHNIQUES_BY_ID: dict[str, Technique] = {t.id: t for t in TECHNIQUES}

CONVENTION_META = {
    "claude": {"mark": "◆", "label": "Claude"},
    "gpt": {"mark": "✦", "label": "GPT"},
    "gemini": {"mark": "✳", "label": "Gemini"},
    "universal": {"mark": "●", "label": "Universal"},
}

CONVENTION_INSTRUCTIONS = {
    "claude": (
        "Formatting convention — Claude (Anthropic): wrap each part of every "
        "generated prompt in XML tags such as <role>, <task>, <context>, "
        "<examples>, <format>, <constraints> as applicable. Anthropic's "
        "documentation states Claude was trained to parse XML-tagged sections "
        "reliably."
    ),
    "gpt": (
        "Formatting convention — GPT (OpenAI): structure each generated prompt "
        "with clear Markdown section headers (### Instructions, ### Context, "
        "### Examples, ### Output Format) or triple-quote-delimited blocks, "
        "instructions before context. This matches OpenAI's documented convention."
    ),
    "gemini": (
        "Formatting convention — Gemini (Google): structure each generated prompt "
        'using the labeled PTCF pattern inline — "Persona: ... Task: ... '
        'Context: ... Format: ..." — staying concise. This matches Google\'s '
        "documented PTCF framework."
    ),
    "universal": (
        "Formatting convention — Universal: write each generated prompt as clear "
        "structured prose without vendor-specific markup, so it reads naturally "
        "when pasted into any model."
    ),
}


def build_system_prompt(technique_ids: list[str], settings: dict, convention: str) -> str:
    """Assemble the system prompt sent to the model for a /api/generate call."""
    base = LENGTH_WORDS.get((settings or {}).get("length"), LENGTH_WORDS["standard"])
    lang = (settings or {}).get("language") or "English"
    tone = (settings or {}).get("tone") or "Neutral"

    lines = [
        "You are an expert prompt engineer producing prompts for OTHER people to "
        "paste into an AI model — you are not answering the underlying task yourself.",
        "Given the task description below, generate ONE prompt for EACH technique "
        "key listed. Each must be a genuinely different construction.",
        f"Write every generated prompt's own text in {lang}. Keep JSON keys in English.",
    ]
    if tone != "Neutral":
        lines.append(f"Write the generated prompts in a {tone.lower()} register.")
    neg = (settings or {}).get("negativeConstraints")
    if neg:
        lines.append(f"Across all versions, steer away from: {neg}.")
    if (settings or {}).get("markdown"):
        lines.append("Light markdown is fine where it helps.")
    else:
        lines.append("Keep formatting plain aside from the target-model convention below.")
    lines.append(CONVENTION_INSTRUCTIONS.get(convention, CONVENTION_INSTRUCTIONS["universal"]))
    lines.append("")
    lines.append("TECHNIQUES TO PRODUCE:")

    shape = {}
    for tid in technique_ids:
        t = TECHNIQUES_BY_ID[tid]
        lines.append("- " + t.instruction(base))
        shape[t.id] = {"label": t.label, "prompt": "...", "rationale": "..."}

    lines.append("")
    lines.append(
        'For each key also include "rationale": max 12 words on which '
        "prompt-engineering principle it applies."
    )
    lines.append("Respond with ONLY valid JSON (no markdown fences), shaped exactly as:")
    lines.append(json.dumps(shape))
    return "\n".join(line for line in lines if line)


def build_user_message(
    task: str, role: str = "", audience: str = "", fmt: str = "", constraints: str = ""
) -> str:
    lines = ["TASK DESCRIPTION:", task or "(not provided)"]
    if role:
        lines.append(f"Intended persona/role: {role}")
    if audience:
        lines.append(f"Audience: {audience}")
    if fmt:
        lines.append(f"Desired output format: {fmt}")
    if constraints:
        lines.append(f"Constraints: {constraints}")
    return "\n".join(lines)


def build_refine_prompt(current_prompt: str, instruction: str, settings: dict, convention: str) -> str:
    lines = [
        "You are an expert prompt engineer revising an existing prompt based on user feedback.",
        "CURRENT PROMPT:",
        current_prompt,
        "",
        "USER'S REQUESTED CHANGE:",
        instruction,
        "",
        CONVENTION_INSTRUCTIONS.get(convention, CONVENTION_INSTRUCTIONS["universal"]),
        "Light markdown is fine." if (settings or {}).get("markdown") else "Keep formatting plain aside from the convention above.",
        "",
        'Respond with ONLY valid JSON: {"prompt": "...", "rationale": "max 12 words on what changed"}',
    ]
    return "\n".join(lines)


def extract_json(raw: str) -> dict:
    """Robustly pull the first balanced {...} JSON object out of a model
    response, tolerating markdown code fences the model may add anyway."""
    if not raw:
        raise ValueError("Empty response from the model.")
    text = raw.strip()
    text = re.sub(r"^```json\s*", "", text, flags=re.I)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"```$", "", text).strip()

    start = text.find("{")
    if start == -1:
        raise ValueError("Model response didn't contain JSON.")

    depth = 0
    end = -1
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        raise ValueError("Incomplete JSON in model response.")

    return json.loads(text[start : end + 1])


def techniques_json() -> list[dict]:
    """Serialized technique catalog for GET /api/techniques."""
    return [
        {
            "id": t.id,
            "label": t.label,
            "principle": t.principle,
            "short": t.short,
            "instructionTemplate": t.instruction_template,
        }
        for t in TECHNIQUES
    ]
