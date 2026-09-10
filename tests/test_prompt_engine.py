import json

import pytest

from kimpto.services import prompt_engine


def test_techniques_json_shape():
    data = prompt_engine.techniques_json()
    assert len(data) == 6
    ids = {t["id"] for t in data}
    assert ids == {"direct", "role", "fewshot", "cot", "structured", "metaprompt"}
    for t in data:
        assert "{words}" in t["instructionTemplate"]


def test_build_system_prompt_includes_each_selected_technique():
    prompt = prompt_engine.build_system_prompt(["direct", "role"], {"length": "standard"}, "claude")
    assert 'Key "direct"' in prompt
    assert 'Key "role"' in prompt
    assert 'Key "fewshot"' not in prompt
    assert "XML tags" in prompt  # claude convention got applied


def test_build_system_prompt_respects_length_setting():
    short_prompt = prompt_engine.build_system_prompt(["role"], {"length": "short"}, "universal")
    long_prompt = prompt_engine.build_system_prompt(["role"], {"length": "long"}, "universal")
    assert "roughly 30 words" in short_prompt
    assert "roughly 95 words" in long_prompt


def test_build_system_prompt_negative_constraints_and_tone():
    prompt = prompt_engine.build_system_prompt(
        ["direct"], {"tone": "Playful", "negativeConstraints": "jargon, passive voice"}, "gpt"
    )
    assert "playful register" in prompt
    assert "jargon, passive voice" in prompt
    assert "Markdown section headers" in prompt  # gpt convention


def test_build_user_message_includes_optional_fields():
    msg = prompt_engine.build_user_message("Summarize tickets", role="Support lead", audience="Managers")
    assert "Summarize tickets" in msg
    assert "Support lead" in msg
    assert "Managers" in msg


def test_build_refine_prompt():
    prompt = prompt_engine.build_refine_prompt("Old prompt text", "make it shorter", {}, "gemini")
    assert "Old prompt text" in prompt
    assert "make it shorter" in prompt
    assert "PTCF" in prompt


def test_extract_json_plain():
    raw = '{"a": 1, "b": "two"}'
    assert prompt_engine.extract_json(raw) == {"a": 1, "b": "two"}


def test_extract_json_strips_markdown_fences():
    raw = '```json\n{"a": 1}\n```'
    assert prompt_engine.extract_json(raw) == {"a": 1}


def test_extract_json_handles_leading_prose():
    raw = 'Sure, here is the JSON:\n{"a": {"nested": true}}\nHope that helps!'
    assert prompt_engine.extract_json(raw) == {"a": {"nested": True}}


def test_extract_json_raises_on_empty():
    with pytest.raises(ValueError):
        prompt_engine.extract_json("")


def test_extract_json_raises_on_no_json():
    with pytest.raises(ValueError):
        prompt_engine.extract_json("no json here at all")


def test_extract_json_raises_on_incomplete_json():
    with pytest.raises(ValueError):
        prompt_engine.extract_json('{"a": 1,')
