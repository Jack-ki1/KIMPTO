# Kimpto — Manual QA Checklist

Use this when you don't want to install Python/Playwright, or when checking
something the automated suite (`smoke_test.py`) doesn't cover — visual
polish, real API calls, or a specific browser. Runs in ~5 minutes.

Open `index.html` (locally or your deployed URL) and work down the list.

## Shell & first load
- [ ] Page loads with no visible layout shift or flash of unstyled content
- [ ] Browser tab title reads "Kimpto — Prompt Generator"
- [ ] Topbar shows the "K" mark, "Kimpto", status dot (idle), theme icon, console icon
- [ ] Sidebar shows Engine (Free / My Key), a model dropdown, and an empty History section

## Theme system
- [ ] Click the theme icon (top-right) — a 4-item menu opens: Graphite, Daybreak, Phosphor, Aurora
- [ ] Selecting each theme visibly recolors the whole app (background, text, accent, the 3 card colors)
- [ ] Phosphor switches the UI font to monospace and shows a faint scanline texture
- [ ] Aurora's "Generate" button shows a cyan→violet→magenta gradient
- [ ] Refresh the page — the theme you left it on is still applied
- [ ] Clicking outside an open theme menu closes it

## Engine sidebar
- [ ] "Free" tab is selected by default; switching to "My Key" swaps the panel content
- [ ] Free panel: model dropdown lists GPT-5.5, GPT-5.4 Nano, Claude Opus 5, Claude Sonnet 5,
      Gemini 3.7 Flash, Grok 4.6, Default, and Custom model id
- [ ] Selecting "Custom model id…" reveals a text input
- [ ] My Key panel: Provider dropdown (Gemini / Groq) swaps the Model list correctly
- [ ] Typing into the API key field doesn't visibly echo the key anywhere else on screen (it's a password input)

## Console (customization drawer)
- [ ] Opens from either the topbar sliders icon or the "Customize · 12" button above the input
- [ ] Three groups visible: OUTPUT, ENGINE TUNING, INTERFACE
- [ ] Length / Few-shot depth / Persona intensity / Density are segmented pickers — clicking an option
      highlights it and un-highlights the previous one
- [ ] Content type, Output language, Tone, Theme are dropdowns and all populate with options
- [ ] Selecting "Custom…" under Output language reveals a free-text field
- [ ] Markdown formatting and Auto-copy are toggle switches with a sliding knob; the label text next to
      each one flips between "On"/"Off" as you toggle it
- [ ] Turning on Auto-copy reveals the "which version" dropdown underneath it
- [ ] Dragging the Creativity slider updates the numeric readout live as you drag, not just on release
- [ ] "Reset all customizations to defaults" restores every field without touching your Engine/model/key settings
- [ ] Closing via the × button, clicking the backdrop, and pressing Esc all close the drawer

## Generating
- [ ] Clicking Generate with an empty task shows a red inline error and focuses the textarea — no console errors
- [ ] With a task typed in, clicking Generate shows: button disables + spinner, 3 shimmering skeleton
      cards replace the placeholder, status dot pulses amber with "generating…"
- [ ] On success: 3 real cards fade in staggered (not all at once), each with a colored left border
      matching its version, a version tag, and a monospace prompt body
- [ ] Each card's "Copy" button copies that card's exact prompt text (paste somewhere to confirm) and
      shows a "Copied" state with a checkmark for ~1.5s before reverting
- [ ] Ctrl/Cmd+Enter in the task textarea also triggers generation
- [ ] A generated task appears at the top of History; clicking a history entry reloads that exact
      task, constraints, and its three cards without a new API call

## Error paths (deliberately break things)
- [ ] Free engine, no internet: clear/reasonable error message, not a raw stack trace
- [ ] My Key → Gemini with no key entered: inline error asking for a key, no request sent
- [ ] My Key → Gemini with an obviously invalid key: a real HTTP error message surfaces (e.g. 400/403),
      not a silent failure
- [ ] My Key → Groq: if it fails immediately with a network error, the message explicitly mentions CORS

## Responsiveness & installability
- [ ] Resize the window under ~760px wide — sidebar moves above the main content, console goes full-width
- [ ] Chrome address bar shows an install icon; installing opens Kimpto in its own window (no tabs/URL bar)
- [ ] Installed window's icon and window title match the app (not a generic globe icon)

## Regression triggers (re-run this checklist when you touch these)
- Any edit to `css/styles.css` theme variable blocks → re-check **Theme system**
- Any edit to `js/config.js` (`DEFAULT_SETTINGS`, option lists, `buildSystemPrompt`) → re-check **Console**
  and re-run `smoke_test.py`
- Any edit to `js/engines.js` → re-check **Error paths** with real keys for each provider
- Any edit to `manifest.webmanifest` or `service-worker.js` → re-check **Responsiveness & installability**,
  and bump the `CACHE` constant in `service-worker.js` so returning users don't get stuck on a stale shell
