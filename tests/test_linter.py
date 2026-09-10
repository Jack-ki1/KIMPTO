from kimpto.services.linter import lint_prompt


def test_empty_prompt_scores_low():
    result = lint_prompt("")
    assert result["score"] < 50
    assert result["wordCount"] == 0


def test_well_structured_prompt_scores_high():
    text = (
        "You are an expert copywriter. Write exactly three bullet points "
        "summarizing the ticket log, in JSON format, and do not exceed 100 words."
    )
    result = lint_prompt(text)
    assert result["score"] >= 75
    assert result["checks"]["persona"] is True
    assert result["checks"]["format"] is True
    assert result["checks"]["constraints"] is True


def test_vague_hedge_words_penalized():
    vague = lint_prompt("Write something about stuff, maybe kind of related to sales.")
    clear = lint_prompt("Write a two-sentence summary of the Q3 sales report.")
    assert vague["score"] < clear["score"]


def test_score_always_in_bounds():
    for text in ["", "a", "word " * 500, "You are an expert. " * 50]:
        result = lint_prompt(text)
        assert 5 <= result["score"] <= 100


def test_tips_never_empty():
    assert len(lint_prompt("")["tips"]) >= 1
    assert len(lint_prompt("A perfectly fine, well-specified prompt with format and must constraints.")["tips"]) >= 1
