# Kimpto (GitHub Pages build)

This is the fully static variant of Kimpto — no Python, no server, nothing
to install to run it. It's a deliberate, minimal fork of the Flask project
so it can be hosted directly on GitHub Pages.

## What's different from the Flask build

| | Flask build | This build |
|---|---|---|
| Free tier (42 models) | Puter.js, client-side | Identical — unchanged |
| Bring-your-own-key: Claude | Proxied through Flask | Called **directly from your browser** |
| Bring-your-own-key: Gemini | Proxied through Flask | Called **directly from your browser** |
| Bring-your-own-key: GPT | Proxied through Flask | **Not available** — see below |
| Technique/model data | Served live from Python | Pre-generated into `data/*.json` |
| Hosting | Needs a Python host (Render, etc.) | GitHub Pages, or any static host |

### Why GPT bring-your-own-key isn't here

Anthropic's and Google's APIs both allow a browser to call them directly —
Anthropic added an explicit `anthropic-dangerous-direct-browser-access`
header for exactly this, and Gemini's standard endpoint accepts a browser
`fetch()` out of the box. **OpenAI's API does not** — it never returns the
`Access-Control-Allow-Origin` header a browser requires, for any origin,
so a direct `fetch()` from any static site fails with a CORS error no
client-side code can work around. This is a server-side policy on
OpenAI's end, not a bug in this app.

GPT models are still fully available in the **Free tier** (routed through
Puter.js, which calls OpenAI on your behalf server-side). If you
specifically need GPT with your own key, run the Flask build instead —
its `/api/generate` route proxies that call server-side, where CORS
doesn't apply.

## Hosting it on GitHub Pages

```bash
cd kimpto-pages
git init
git add .
git commit -m "Kimpto — static build"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Build and deployment →
Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.

GitHub gives you a URL like `https://<your-username>.github.io/<your-repo>/`
within a minute or two. That's it — there's no build step, no CI required,
and no environment variables to configure. The included `.nojekyll` file
tells GitHub Pages not to run its default Jekyll processing (which ignores
some file/folder name patterns this project doesn't use, but is one less
thing to think about).

If you'd rather serve it from your own domain, add a `CNAME` file with
your domain name at the repo root and point your DNS at GitHub Pages per
[their custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) —
everything else here works unchanged.

## Previewing it locally before you push

Opening `index.html` directly with `file://` won't work — browsers block
`fetch()` of local files under that scheme, and this app fetches
`data/techniques.json` and `data/models.json` on load. Serve it over
plain HTTP instead:

```bash
cd kimpto-pages
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000`.

## Updating the technique/model data

`data/techniques.json` and `data/models.json` are pre-built snapshots
generated from the Flask project's `kimpto/services/prompt_engine.py` and
`models_catalog.py` — that Python code is still the single source of
truth for wording; this build just can't run it live. After editing
either file in the Flask project, regenerate both JSON files:

```bash
python3 scripts/build_data.py /path/to/kimpto-flask
```

Commit the two updated files in `data/` along with your change.

## Everything else

Same techniques (Direct & Concise, Role-Based & Detailed, Creative &
Few-Shot, Chain-of-Thought, Structured Output, Meta-Prompt), same
model-specific formatting conventions (Claude → XML tags, GPT → Markdown
headers, Gemini → PTCF, everything else → plain structured prose), same
voice input/output, compare/diff, prompt-quality scoring, session history
and saved-prompt library (both in `localStorage`, per-browser) as the
Flask build. See that project's `README.md` for the full explanation of
the technique library and the research it's grounded in — none of that
changed here, only how BYOK requests are transported.

## Security note

With no server at all in this build, a bring-your-own-key request goes
straight from your browser to that provider's own API and nowhere else —
there's no backend to even temporarily hold it. The key is not saved to
`localStorage` across reloads (re-enter it each session); see
`js/storage.js`.

## License

MIT — see the Flask project's `LICENSE` file.
