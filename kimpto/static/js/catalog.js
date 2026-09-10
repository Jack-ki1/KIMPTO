// catalog.js
//
// Fetches the technique and model catalogs from the Flask backend
// (kimpto/services/prompt_engine.py and models_catalog.py are the source of
// truth) and mirrors the same prompt-assembly + heuristic-linting logic in
// JavaScript. That mirror is required, not optional: free-tier generation
// calls Puter.js directly from the browser (Puter's keyless access only
// works in a real browser context), so it can never round-trip through the
// Flask backend the way bring-your-own-key generation does. Keeping the
// wording itself server-authoritative (fetched, not hardcoded here) means
// there is still only one place technique copy is written by hand.

const LENGTH_WORDS = { short: 30, standard: 55, long: 95 };

let _techniques = null;
let _models = null;

export async function loadCatalog() {
  const [techRes, modelRes] = await Promise.all([
    fetch("/api/techniques").then((r) => r.json()),
    fetch("/api/models").then((r) => r.json()),
  ]);
  _techniques = techRes.techniques;
  _models = modelRes;
  return { techniques: _techniques, models: _models };
}

export function getTechniques() {
  return _techniques || [];
}
export function getTechniqueById(id) {
  return (_techniques || []).find((t) => t.id === id);
}
export function getModels() {
  return _models;
}

export function conventionForFreeModel(modelId) {
  const groups = (_models && _models.free) || [];
  const group = groups.find((g) => g.models.some((m) => m.id === modelId));
  return group ? group.convention : "universal";
}

export function currentModelLabel(modelChoice) {
  if (modelChoice.mode === "byok") {
    const list = (_models && _models.byok[modelChoice.byokProvider]) || [];
    const model = list.find((m) => m.id === modelChoice.byokModel);
    return (model ? model.label : modelChoice.byokModel) + " · your key";
  }
  const groups = (_models && _models.free) || [];
  const group = groups.find((g) => g.models.some((m) => m.id === modelChoice.free));
  const model = group ? group.models.find((m) => m.id === modelChoice.free) : null;
  return (model ? model.label : modelChoice.free) + " · free";
}

export function deriveConvention(modelChoice) {
  if (modelChoice.mode === "byok") return modelChoice.byokProvider;
  return conventionForFreeModel(modelChoice.free);
}

const CONVENTION_INSTRUCTIONS = {
  claude:
    "Formatting convention — Claude (Anthropic): wrap each part of every generated prompt in XML tags such as <role>, <task>, <context>, <examples>, <format>, <constraints> as applicable. Anthropic's documentation states Claude was trained to parse XML-tagged sections reliably.",
  gpt: "Formatting convention — GPT (OpenAI): structure each generated prompt with clear Markdown section headers (### Instructions, ### Context, ### Examples, ### Output Format) or triple-quote-delimited blocks, instructions before context. This matches OpenAI's documented convention.",
  gemini:
    'Formatting convention — Gemini (Google): structure each generated prompt using the labeled PTCF pattern inline — "Persona: ... Task: ... Context: ... Format: ..." — staying concise. This matches Google\'s documented PTCF framework.',
  universal:
    "Formatting convention — Universal: write each generated prompt as clear structured prose without vendor-specific markup, so it reads naturally when pasted into any model.",
};

// --- prompt assembly (mirrors kimpto/services/prompt_engine.py) ---------

export function buildSystemPrompt(techniqueIds, settings, convention) {
  const base = LENGTH_WORDS[settings.length] || LENGTH_WORDS.standard;
  const lang = settings.language || "English";
  const lines = [
    "You are an expert prompt engineer producing prompts for OTHER people to paste into an AI model — you are not answering the underlying task yourself.",
    "Given the task description below, generate ONE prompt for EACH technique key listed. Each must be a genuinely different construction.",
    `Write every generated prompt's own text in ${lang}. Keep JSON keys in English.`,
    settings.tone && settings.tone !== "Neutral" ? `Write the generated prompts in a ${settings.tone.toLowerCase()} register.` : "",
    settings.negativeConstraints ? `Across all versions, steer away from: ${settings.negativeConstraints}.` : "",
    settings.markdown ? "Light markdown is fine where it helps." : "Keep formatting plain aside from the target-model convention below.",
    CONVENTION_INSTRUCTIONS[convention] || CONVENTION_INSTRUCTIONS.universal,
    "",
    "TECHNIQUES TO PRODUCE:",
  ];
  const shape = {};
  techniqueIds.forEach((id) => {
    const t = getTechniqueById(id);
    if (!t) return;
    lines.push("- " + t.instructionTemplate.replace("{words}", String(base)));
    shape[t.id] = { label: t.label, prompt: "...", rationale: "..." };
  });
  lines.push("");
  lines.push('For each key also include "rationale": max 12 words on which prompt-engineering principle it applies.');
  lines.push("Respond with ONLY valid JSON (no markdown fences), shaped exactly as:");
  lines.push(JSON.stringify(shape));
  return lines.filter(Boolean).join("\n");
}

export function buildUserMessage(form) {
  const lines = ["TASK DESCRIPTION:", form.task || "(not provided)"];
  if (form.role) lines.push("Intended persona/role: " + form.role);
  if (form.audience) lines.push("Audience: " + form.audience);
  if (form.format) lines.push("Desired output format: " + form.format);
  if (form.constraints) lines.push("Constraints: " + form.constraints);
  return lines.join("\n");
}

export function buildRefinePrompt(currentPrompt, instruction, settings, convention) {
  return [
    "You are an expert prompt engineer revising an existing prompt based on user feedback.",
    "CURRENT PROMPT:",
    currentPrompt,
    "",
    "USER'S REQUESTED CHANGE:",
    instruction,
    "",
    CONVENTION_INSTRUCTIONS[convention] || CONVENTION_INSTRUCTIONS.universal,
    settings.markdown ? "Light markdown is fine." : "Keep formatting plain aside from the convention above.",
    "",
    'Respond with ONLY valid JSON: {"prompt": "...", "rationale": "max 12 words on what changed"}',
  ].join("\n");
}

export function extractJSON(raw) {
  if (!raw) throw new Error("Empty response from the model.");
  let text = String(raw).trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Model response didn't contain JSON.");
  let depth = 0,
    end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Incomplete JSON in model response.");
  return JSON.parse(text.slice(start, end + 1));
}

// --- linter (mirrors kimpto/services/linter.py) -------------------------

export function lintPrompt(text) {
  const t = text || "";
  const words = t.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const checks = {
    format: /(format|json|bullet|steps|numbered|markdown|schema)/i.test(t),
    constraints: /(must|only|do not|don't|avoid|no more than|limit|exactly|maximum)/i.test(t),
    persona: /(you are|as a|acting as)/i.test(t),
    length: wordCount >= 12,
  };
  const hasVague = /(\bsomething\b|\bstuff\b|\bmaybe\b|\bkind of\b|\bsort of\b|\betc\.?\b)/i.test(t);
  let score = 40;
  if (checks.length) score += 10;
  if (wordCount > 30) score += 5;
  if (checks.format) score += 15;
  if (checks.constraints) score += 15;
  if (checks.persona) score += 10;
  score += hasVague ? -15 : 5;
  score = Math.max(5, Math.min(100, score));
  const tips = [];
  if (!checks.format) tips.push("No explicit output format — the model may drift between plain text and lists across runs.");
  if (!checks.constraints) tips.push("No hard constraints (length, scope) — output length may vary run to run.");
  if (hasVague) tips.push("Contains vague hedge words.");
  if (!checks.length) tips.push("Very short — may be under-specified.");
  if (tips.length === 0) tips.push("Solid structure — has a clear format and constraints.");
  return { score, wordCount, tips, checks };
}

// --- misc text utilities -------------------------------------------------

export function findVariables(text) {
  const set = new Set();
  const re = /{{\s*([\w. -]+?)\s*}}/g;
  let m;
  while ((m = re.exec(text || ""))) set.add(m[1]);
  return [...set];
}

export function resolveVariables(text, values) {
  return (text || "").replace(/{{\s*([\w. -]+?)\s*}}/g, (whole, name) => (values[name] && values[name].trim() ? values[name] : whole));
}

export function diffWords(a, b) {
  const aw = (a || "").split(/(\s+)/);
  const bw = (b || "").split(/(\s+)/);
  const n = aw.length,
    m = bw.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (aw[i] === bw[j]) {
      result.push({ type: "same", text: aw[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: aw[i] });
      i++;
    } else {
      result.push({ type: "added", text: bw[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "removed", text: aw[i] });
    i++;
  }
  while (j < m) {
    result.push({ type: "added", text: bw[j] });
    j++;
  }
  return result;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const TECH_ACCENTS = ["#4f7cff", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];
export const CONVENTION_META = {
  claude: { mark: "◆", label: "Claude" },
  gpt: { mark: "✦", label: "GPT" },
  gemini: { mark: "✳", label: "Gemini" },
  universal: { mark: "●", label: "Universal" },
};
