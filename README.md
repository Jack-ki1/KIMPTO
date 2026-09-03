# Kimpto — Prompt Generator Console

Kimpto turns one task description into **three structurally distinct
prompts** — Direct & Concise, Role-Based & Detailed, and Creative & Advanced
— tuned by a 12-control customization console, themeable, and installable as
a standalone desktop app. It's a static site: no build step, no backend, no
server costs, and no framework — plain ES modules the browser runs directly.

It's powered by either **free, keyless AI models** (via
[Puter.js](https://developer.puter.com)) or **your own Gemini/Groq API key**.

## Contents

- [Features](#features)
- [Project structure](#project-structure)
- [Running it locally](#running-it-locally)
- [Deploying it](#deploying-it)
- [Installing it as a desktop app](#installing-it-as-a-desktop-app)
- [Engines & models](#engines--models)
- [The Console — 12 customizations](#the-console--12-customizations)
- [How the prompt engine works](#how-the-prompt-engine-works)
- [Testing guidelines](#testing-guidelines)
- [Extending Kimpto](#extending-kimpto)
- [Troubleshooting / FAQ](#troubleshooting--faq)
- [Security & privacy](#security--privacy)
- [Browser support](#browser-support)

## Features

- **Two ways to reach a model** — keyless via Puter.js, or bring-your-own-key
  for Gemini/Groq, switchable per generation from the sidebar
- **One call, three versions** — a single request returns all three prompt
  variants as structured JSON, so they're generated aware of each other
  rather than as three independent, possibly-overlapping calls
- **12 live customizations** grouped into Output / Engine tuning / Interface,
  every one of which actually changes the request sent to the model, not
  just the UI
- **4 hand-built themes** — Graphite, Daybreak, Phosphor, Aurora — each with
  its own full color system, not a single light/dark toggle
- **Installable** — a real web app manifest + service worker, so Chrome/Edge
  can install it as a standalone window with its own icon
- **Persistent** — settings and the last 8 generations survive a reload via
  `localStorage`; no account, no database
- **Copy-to-clipboard per card**, keyboard shortcut (`Ctrl`/`Cmd`+`Enter`) to
  generate, and defensive JSON parsing so a model that wraps its answer in
  markdown fences still renders correctly

## Project structure

```
kimpto/
├── index.html                      Page shell: topbar, sidebar, main, console drawer
├── manifest.webmanifest            PWA metadata — name, icons, standalone display mode
├── service-worker.js               Caches the static shell only; never touches API calls
├── css/
│   └── styles.css                  All 4 theme variable sets + every component's styles
├── js/
│   ├── config.js                   Model lists, customization option tables, buildSystemPrompt()
│   ├── storage.js                  localStorage read/write for settings + history
│   ├── engines.js                  callPuter() / callGemini() / callGroq() + JSON extraction
│   ├── ui.js                       DOM rendering: console, result cards, history, theme menu
│   └── main.js                     Wires it all together; the generate() orchestration flow
├── icons/                          App icons: 192px, 512px, maskable 512px, favicons
├── tests/
│   ├── smoke_test.py               Automated end-to-end test suite (Playwright)
│   └── MANUAL-QA-CHECKLIST.md      No-tooling-required manual test pass
└── README.md                       You are here
```

No `package.json`, no bundler, no `node_modules` in the shipped app — every
`<script type="module">` import in `index.html` → `js/main.js` resolves
directly to a file in this repo. That's deliberate: it keeps deployment to
"upload these files" with nothing to build first.

## Running it locally

Any static file server works, since ES modules must be served over
`http(s)://`, not opened as a bare `file://` path (the browser blocks module
imports from `file://` for security reasons). Pick whichever you already
have installed:

```bash
# Python (built into most systems)
py -m http.server 8080

# Node
npx http-server -p 8080

# PHP
php -S localhost:8080
```

Then open `http://localhost:8080/index.html`.

## Deploying it

### GitHub Pages
1. Create a repo (e.g. `kimpto`) and push everything in this folder to it,
   with `index.html` at the repo root (or the folder you point Pages at).
2. **Settings → Pages → Source → Deploy from a branch**, choose `main` and
   `/ (root)`, save.
3. Your app is live at `https://yourname.github.io/kimpto/` within a minute
   or two. GitHub Pages serves everything over HTTPS automatically, which
   the Puter.js popup flow and the service worker both require.

### Netlify / Vercel / Cloudflare Pages
All three auto-detect "no build command, publish the root folder" for a
plain static site — drag-and-drop the `kimpto/` folder onto Netlify's
deploy target, or run `vercel` / `wrangler pages deploy` from inside the
folder. No configuration file is required for any of them.

### Any other static host
Amazon S3 + CloudFront, an nginx box, a shared host — anything that serves
static files over HTTPS works identically. The only requirement is HTTPS
(or `localhost`), because service workers and some clipboard APIs refuse to
run over plain HTTP.

## Installing it as a desktop app

Once it's hosted (or even running locally), open it in Chrome and use
**either** of these:

**Option A — Install as a PWA (recommended)**
Click the install icon (⊕) in Chrome's address bar, or Chrome menu (⋮) →
**"Install Kimpto…"**. This uses `manifest.webmanifest` to open a real
standalone window with the Kimpto icon, no tabs or address bar, pinnable to
your taskbar/dock and optionally your desktop.

**Option B — Create Shortcut**
Chrome menu (⋮) → **More Tools → Create Shortcut…** → check **"Open as
window"** → Create. Drops an icon directly on your desktop that opens Kimpto
in its own app-style window, no PWA install prompt required.

Edge supports the same install flow via its own menu. Firefox and Safari
don't offer the same one-click desktop install for arbitrary sites, though
the site itself works fully in either browser.

> **First run:** if you use the Free engine, Puter opens a one-time sign-in
> popup. Make sure the browser (or the installed app window) isn't blocking
> popups for Kimpto — after that first sign-in it's remembered for future
> sessions.

## Engines & models

### Free — Puter.js (no key)
Routed through Puter's hosted infrastructure at `js.puter.com`. The curated
model list in `config.js` (`PUTER_MODELS`) currently offers GPT-5.5, GPT-5.4
Nano, Claude Opus 5, Claude Sonnet 5, Gemini 3.7 Flash, and Grok 4.6, plus a
"Default" option and a free-text custom model id field for anything Puter
adds later. Reliability depends on Puter's own uptime and free-tier terms,
not an official provider SLA — treat it as the low-friction default, not a
guarantee.

### My Key — Gemini
Get a free key at [Google AI Studio](https://aistudio.google.com/apikey) —
no credit card required for the Flash-tier models Kimpto uses
(`gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-3-flash`). Gemini is
built to support direct browser calls, which is why it's the more reliable
BYOK option of the two.

### My Key — Groq
Get a free key at [console.groq.com](https://console.groq.com/keys). Groq is
dramatically fast, but its documentation and SDKs are written for
server-side use — a direct browser call can be blocked by CORS depending on
your account. Kimpto attempts it anyway and surfaces a specific "this is
almost always a CORS block" message if the request never leaves the browser,
so a failure here reads as a diagnosis, not a mystery.

## The Console — 12 customizations

Open it from the sliders icon in the topbar or the **Customize** button
above the input box. Every control edits `settings` in `main.js`, which
`config.js`'s `buildSystemPrompt()` turns into actual instruction text (or,
for Creativity, the API's `temperature` parameter) — nothing here is
cosmetic-only.

| Group | Control | What it actually changes |
|---|---|---|
| Output | **Length** | Word-count targets injected per version (Short/Standard/Long) |
| Output | **Content type** | Domain framing line — code, writing, marketing, data, image-gen, academic, or general |
| Output | **Output language** | The language the generated *prompt text* is written in (JSON keys stay in English so parsing stays reliable) |
| Output | **Tone** | The register the generated prompts are written in |
| Output | **Markdown formatting** | Whether the generated prompts use light markdown or plain text |
| Engine tuning | **Creativity** | Sent directly as `temperature` to the API (0.2–1.2) |
| Engine tuning | **Few-shot depth** | 1 or 2 example pairs required inside Version 3 |
| Engine tuning | **Persona intensity** | Light (one-line) vs. deep (named sub-specialty + stakes) persona for Version 2 |
| Engine tuning | **Negative constraints** | Free text folded into all three versions as things to avoid |
| Interface | **Theme** | Graphite / Daybreak / Phosphor / Aurora |
| Interface | **Density** | Comfortable vs. compact spacing throughout |
| Interface | **Auto-copy** | Automatically copies a chosen version to the clipboard on generation |

## How the prompt engine works

Kimpto makes exactly **one** API call per generation, not three — the system
prompt built by `buildSystemPrompt()` asks for all three versions in a
single structured JSON response, so the versions are generated aware of each
other instead of independently converging on similar phrasing. Each version
is bound to a different **structural primitive**, not just a different tone,
which is what actually forces distinctness:

- **Version 1 (Direct & Concise):** a pure imperative instruction, hard word
  ceiling, explicitly forbidden from using persona, steps, or examples
- **Version 2 (Role-Based & Detailed):** must open with an expert persona,
  must contain a numbered step breakdown, must specify an output format
- **Version 3 (Creative & Advanced):** must include a `{{variable}}`
  placeholder and at least one few-shot example pair, must reframe the task
  from an angle the other two didn't use

`engines.js`'s `extractJSON()` defensively strips markdown code fences and
locates the outermost `{...}` block before parsing, since not every
free-tier model reliably honors "respond with only JSON."

## Testing guidelines

Two layers, pick based on what changed:

### 1. Automated — `tests/smoke_test.py`
A Playwright-driven suite that loads the real app in a headless browser and
checks the things most likely to silently break: theme switching, the
console's field count and controls, engine tab visibility, input validation,
error-path messaging, and that settings actually survive a reload.

```bash
pip install playwright
playwright install chromium

# from the project root, in one terminal:
python3 -m http.server 8080

# in another terminal:
python3 tests/smoke_test.py
```

It prints a `PASS`/`FAIL` line per check and exits non-zero on any failure,
so it's safe to drop into a pre-commit hook or a CI job. To test a live
deployment instead of localhost:

```bash
KIMPTO_URL="https://yourname.github.io/kimpto/index.html" python3 tests/smoke_test.py
```

**Run this after touching:** `js/config.js`, `js/main.js`, `js/ui.js`, or
`css/styles.css`'s structural (non-color) rules.

### 2. Manual — `tests/MANUAL-QA-CHECKLIST.md`
A ~5-minute click-through checklist for things the automated suite
deliberately doesn't cover: real API responses (it can't hold your API
keys), visual correctness across all 4 themes, and the actual OS-level
"install as app" flow. Also useful if you don't want to set up Python at
all — it needs nothing but a browser.

**Run this after touching:** anything visual, `js/engines.js`, or
`manifest.webmanifest`/`service-worker.js`.

Both files list which section to re-check for which kind of change, so a
small edit doesn't require re-testing everything from scratch.

## Extending Kimpto

- **Add a Puter model:** append `{ id: "provider/model-id", label: "Display Name" }`
  to `PUTER_MODELS` in `js/config.js`.
- **Add a theme:** add a new `[data-theme="yourtheme"]{ ... }` block in
  `css/styles.css` defining every variable the other themes define, then add
  `{ id: "yourtheme", label: "Your Theme", swatch: "#hex" }` to `THEMES` in
  `config.js` — the theme menu and the console's theme dropdown both render
  from that array automatically.
- **Add a customization:** add a default to `DEFAULT_SETTINGS`, a control for
  it in `renderConsole()` in `js/ui.js`, and a line in `buildSystemPrompt()`
  in `config.js` that actually uses the new setting. All three are required
  — a control with nothing reading its value is decoration, not a feature.
- **Add a new engine (e.g. a different provider):** write a `callX()`
  function in `js/engines.js` matching the signature of the existing three
  (`systemPrompt, userMessage, settings) => Promise<string>`), then branch to
  it in `generate()` in `js/main.js`.

## Troubleshooting / FAQ

**The Puter sign-in popup never appears / generation hangs on Free mode.**
Check your browser's popup blocker for this site. If Kimpto is running
inside an `<iframe>` (e.g. embedded in another dashboard), the iframe needs
`allow-popups` and `allow-same-origin` in its `sandbox` attribute.

**Groq always fails immediately.**
That's the CORS block described above — switch to Gemini or the Free
engine. This isn't a bug in Kimpto; Groq's API isn't designed for
unauthenticated cross-origin browser calls.

**Gemini returns a 429 or a quota error.**
You've hit the free-tier rate limit for your key (requests-per-minute or
per-day). Wait for it to reset, or switch to the Free engine for that
generation.

**The install icon never shows up in Chrome's address bar.**
PWA install requires HTTPS (or `localhost`) and a reachable manifest +
icons. If you're testing over plain `http://` on a non-localhost address,
Chrome won't offer the install prompt — deploy it or test on `localhost`.

**I changed the code but my browser still shows the old version.**
The service worker caches the shell aggressively for speed. Bump the
`CACHE` constant at the top of `service-worker.js` (e.g. `kimpto-shell-v3`)
whenever you ship a change — that invalidates the old cache on the next
load.

## Security & privacy

- Everything runs client-side. There's no backend collecting anything.
- API keys are stored only in `localStorage` in your own browser and are
  sent only in the request to that key's own provider (Google or Groq) —
  never to Puter, never anywhere else.
- If you ever share a deployed URL with someone else who'll use the same
  browser profile, treat it like sharing a device with your key typed into a
  form: use the Free engine, or don't save a key there.
- The service worker only caches same-origin static files (`index.html`,
  `css/`, `js/`, icons). It never intercepts or caches requests to
  `js.puter.com`, `generativelanguage.googleapis.com`, or `api.groq.com` —
  every generation is a fresh network call.

## Browser support

Built on standard ES modules, `fetch`, CSS custom properties, and
`localStorage` — no polyfills, no transpilation. Works in current Chrome,
Edge, Firefox, and Safari. One-click desktop install (PWA) is a
Chromium-specific feature (Chrome/Edge); Firefox and Safari users get the
full app experience in-browser but not the native install prompt.
