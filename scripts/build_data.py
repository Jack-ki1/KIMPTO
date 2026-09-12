#!/usr/bin/env python3
"""
Regenerates data/techniques.json and data/models.json from the same Python
source of truth used by the Flask build (kimpto/services/prompt_engine.py
and models_catalog.py in the companion Flask project). Run this whenever
you edit technique wording or the model catalog there, then re-commit the
two JSON files here — this static build has no server to generate them on
the fly, so they're checked-in, pre-built artifacts.

Usage:
    python3 scripts/build_data.py /path/to/kimpto-flask

If you don't have the Flask project on hand, the two files already in
data/ are a valid, ready-to-use snapshot — you only need this script when
you want to change the underlying technique/model data.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/build_data.py /path/to/kimpto-flask", file=sys.stderr)
        sys.exit(1)

    flask_root = Path(sys.argv[1]).resolve()
    if not (flask_root / "kimpto" / "services" / "prompt_engine.py").exists():
        print(f"Couldn't find kimpto/services/prompt_engine.py under {flask_root}", file=sys.stderr)
        sys.exit(1)

    sys.path.insert(0, str(flask_root))
    from kimpto.services import prompt_engine  # noqa: E402
    from kimpto.services.models_catalog import (  # noqa: E402
        BYOK_MODELS,
        FREE_MODEL_COUNT,
        FREE_MODEL_GROUPS,
    )

    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(exist_ok=True)

    (out_dir / "techniques.json").write_text(
        json.dumps({"techniques": prompt_engine.techniques_json()}, indent=2)
    )

    # Only Claude and Gemini can be called directly from a browser (see
    # README.md) — GPT stays out of this static build's BYOK list even
    # though the Flask project's BYOK_MODELS still defines it, since GPT
    # remains fully usable via the Free tier here.
    byok_static = {k: v for k, v in BYOK_MODELS.items() if k in ("claude", "gemini")}

    (out_dir / "models.json").write_text(
        json.dumps(
            {
                "free": FREE_MODEL_GROUPS,
                "freeCount": FREE_MODEL_COUNT,
                "byok": byok_static,
                "conventions": prompt_engine.CONVENTION_META,
            },
            indent=2,
        )
    )

    print(f"Wrote {out_dir / 'techniques.json'} and {out_dir / 'models.json'}")


if __name__ == "__main__":
    main()
