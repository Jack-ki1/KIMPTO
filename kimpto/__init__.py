from __future__ import annotations

import os

from flask import Flask


def create_app(test_config: dict | None = None) -> Flask:
    """Application factory. Using this pattern (rather than a bare module-
    level Flask instance) is what makes the app testable with pytest and
    deployable behind gunicorn without changing any code."""
    app = Flask(__name__, static_folder="static", template_folder="templates")

    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
        JSON_SORT_KEYS=False,
    )
    if test_config:
        app.config.update(test_config)

    from .routes import api, views

    app.register_blueprint(views.bp)
    app.register_blueprint(api.bp)

    @app.after_request
    def _security_headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "no-referrer"
        return resp

    return app
