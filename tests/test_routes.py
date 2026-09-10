import pytest

from kimpto import create_app


@pytest.fixture
def client():
    app = create_app({"TESTING": True})
    with app.test_client() as client:
        yield client


def test_index_page_loads(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"Kimpto" in resp.data


def test_techniques_endpoint(client):
    resp = client.get("/api/techniques")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["techniques"]) == 6


def test_models_endpoint(client):
    resp = client.get("/api/models")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["freeCount"] >= 40
    assert "claude" in data["byok"]
    assert "gpt" in data["byok"]
    assert "gemini" in data["byok"]


def test_lint_endpoint(client):
    resp = client.post("/api/lint", json={"text": "You are an expert. Respond in JSON, must be under 50 words."})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "score" in data


def test_generate_requires_task(client):
    resp = client.post("/api/generate", json={"provider": "claude", "model": "claude-sonnet-5", "apiKey": "x"})
    assert resp.status_code == 400


def test_generate_requires_api_key(client):
    resp = client.post(
        "/api/generate",
        json={"task": "Summarize tickets", "provider": "claude", "model": "claude-sonnet-5"},
    )
    assert resp.status_code == 400


def test_generate_rejects_unknown_provider(client):
    resp = client.post(
        "/api/generate",
        json={"task": "Summarize tickets", "provider": "not-a-real-provider", "apiKey": "x"},
    )
    assert resp.status_code == 400


def test_generate_rejects_unknown_technique(client):
    resp = client.post(
        "/api/generate",
        json={
            "task": "Summarize tickets",
            "provider": "claude",
            "model": "claude-sonnet-5",
            "apiKey": "x",
            "techniques": ["not-a-real-technique"],
        },
    )
    assert resp.status_code == 400


def test_generate_bad_key_surfaces_as_502_not_500(client):
    # A syntactically-present-but-invalid key should fail as a clean
    # provider error (502), never an unhandled 500.
    resp = client.post(
        "/api/generate",
        json={
            "task": "Summarize tickets",
            "provider": "claude",
            "model": "claude-sonnet-5",
            "apiKey": "sk-not-a-real-key",
            "techniques": ["direct"],
        },
    )
    assert resp.status_code in (502, 400)


def test_refine_requires_fields(client):
    resp = client.post("/api/refine", json={})
    assert resp.status_code == 400


def test_test_run_requires_fields(client):
    resp = client.post("/api/test-run", json={})
    assert resp.status_code == 400
