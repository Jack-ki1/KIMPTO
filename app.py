"""
Entrypoint for both local development and production WSGI servers.

Local:      python app.py
Production: gunicorn app:app   (see Procfile)
"""
import os

from kimpto import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
