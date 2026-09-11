// catalog.js
//
// This is the static-site counterpart of the Flask build's catalog.js. In
// the Flask version, technique wording and the model catalog lived once in
// Python (kimpto/services/prompt_engine.py) and the browser fetched them
// from GET /api/techniques and GET /api/models. A static site has no
// server to fetch from, so that data is inlined here instead — this file
// is now the single source of truth. If you ever bring the Flask backend
// back, keep prompt_engine.py and this file in sync by hand.

const LENGTH_WORDS = { short: 30, standard: 55, long: 95 };

/* =========================================================================
   TECHNIQUE LIBRARY — six techniques covering the bulk of production
   prompt-engineering use cases (role/task/format, few-shot, chain-of-
   thought, structured output, meta-prompting, self-refine).
   ========================================================================= */

const TECHNIQUES = [
  {
    id: "direct",
    label: "Direct & Concise",
    principle: "RTF pattern",
    short: "One imperative instruction. Role → Task → Format, nothing else.",
    instructionTemplate:
      'Key "direct" — Direct & Concise: a single pure imperative instruction following Role→Task→Format. Hard ceiling of {words} words. FORBIDDEN: persona assignment, numbered steps, examples, background context.',
  },
  {
    id: "role",
    label: "Role-Based & Detailed",
    principle: "Persona framing",
    short: "Expert persona, numbered steps, explicit output format.",
    instructionTemplate:
      'Key "role" — Role-Based & Detailed: open by assigning a specific expert persona ("You are a..."), include a numbered breakdown of at least 3 steps, and specify an explicit output format. Target roughly {words} words.',
  },
  {
    id: "fewshot",
    label: "Creative & Few-Shot",
    principle: "Few-shot examples",
    short: "A {{variable}} placeholder plus one input→output example pair.",
    instructionTemplate:
      'Key "fewshot" — Creative & Few-Shot: include at least one {{variable}} placeholder and one short worked example ("Input: ... -> Output: ..."), reframing the task from a fresh angle. Target roughly {words} words.',
  },
  {
    id: "cot",
    label: "Chain-of-Thought",
    principle: "Wei et al., reasoning",
    short: "Instructs step-by-step reasoning before the final answer.",
    instructionTemplate:
      'Key "cot" — Chain-of-Thought: explicitly instruct the model to reason step-by-step internally before giving a final answer, and state whether the reasoning should be shown or hidden. Target roughly {words} words.',
  },
  {
    id: "structured",
    label: "Structured Output",
    principle: "Schema pinning",
    short: "Pins the response to an explicit schema for reliable parsing.",
    instructionTemplate:
      'Key "structured" — Structured Output: pin the response to an explicit schema (JSON keys with types, or a fixed Markdown structure) written out inline. Target roughly {words} words.',
  },
  {
    id: "metaprompt",
    label: "Meta-Prompt",
    principle: "Self-refine / Reflexion",
    short: "Asks the model to draft, critique, then refine its own approach.",
    instructionTemplate:
      'Key "metaprompt" — Meta-Prompt: instruct the model to silently draft an approach, critique it against the task\'s goals, then produce only the refined final instruction. Target roughly {words} words.',
  },
];

const TECHNIQUES_BY_ID = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));

/* =========================================================================
   MODEL CATALOG
   ========================================================================= */

const FREE_MODEL_GROUPS = [
  { name: "OpenAI", accent: "#10a37f", convention: "gpt", blurb: "General-purpose, strong all-rounders.",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5" }, { id: "gpt-5.4", label: "GPT-5.4" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" }, { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
      { id: "gpt-4o", label: "GPT-4o" }, { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "o4-mini", label: "o4-mini (reasoning)" }, { id: "o3-mini", label: "o3-mini (reasoning)" },
    ] },
  { name: "Anthropic", accent: "#d97757", convention: "claude", blurb: "Careful and structured — great at following detailed instructions.",
    models: [
      { id: "claude-opus-5", label: "Claude Opus 5" }, { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" }, { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
    ] },
  { name: "Google", accent: "#4285f4", convention: "gemini", blurb: "Fast, multimodal, strong on long context.",
    models: [
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro" }, { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" }, { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }, { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ] },
  { name: "xAI", accent: "#1a1a1a", convention: "universal", blurb: "Real-time aware, casual reasoning style.",
    models: [ { id: "grok-4.6", label: "Grok 4.6" }, { id: "grok-4", label: "Grok 4" }, { id: "grok-3", label: "Grok 3" } ] },
  { name: "DeepSeek", accent: "#4d6bfe", convention: "universal", blurb: "Excellent at multi-step math & reasoning.",
    models: [ { id: "deepseek-v3", label: "DeepSeek V3" }, { id: "deepseek-r1", label: "DeepSeek R1 (reasoner)" } ] },
  { name: "Meta Llama", accent: "#0866ff", convention: "universal", blurb: "Open-weight, solid generalists.",
    models: [
      { id: "llama-4-maverick", label: "Llama 4 Maverick" }, { id: "llama-4-scout", label: "Llama 4 Scout" },
      { id: "llama-3.3-70b", label: "Llama 3.3 70B" }, { id: "llama-3.1-405b", label: "Llama 3.1 405B" }, { id: "llama-3.1-8b", label: "Llama 3.1 8B" },
    ] },
  { name: "Mistral", accent: "#fa5210", convention: "universal", blurb: "Efficient, fast, strong at code.",
    models: [ { id: "mistral-large", label: "Mistral Large" }, { id: "mistral-small", label: "Mistral Small" }, { id: "mixtral-8x22b", label: "Mixtral 8x22B" } ] },
  { name: "Qwen", accent: "#6f42ff", convention: "universal", blurb: "Strong multilingual performance.",
    models: [ { id: "qwen3-235b", label: "Qwen3 235B" }, { id: "qwen3-32b", label: "Qwen3 32B" }, { id: "qwen2.5-72b", label: "Qwen2.5 72B" } ] },
  { name: "Google Gemma", accent: "#34a853", convention: "universal", blurb: "Lightweight open models, good for quick drafts.",
    models: [ { id: "gemma-4-27b", label: "Gemma 4 27B" }, { id: "gemma-4-9b", label: "Gemma 4 9B" }, { id: "gemma-2-27b", label: "Gemma 2 27B" } ] },
  { name: "Moonshot AI", accent: "#7c3aed", convention: "universal", blurb: "Long-context specialist (Kimi).",
    models: [ { id: "kimi-k2", label: "Kimi K2" } ] },
  { name: "Z.AI", accent: "#0ea5e9", convention: "universal", blurb: "Fast open-weight all-rounder (GLM).",
    models: [ { id: "glm-4.6", label: "GLM-4.6" }, { id: "glm-4.5", label: "GLM-4.5" } ] },
  { name: "Microsoft", accent: "#00a4ef", convention: "universal", blurb: "Compact, efficient small models.",
    models: [ { id: "phi-4", label: "Phi-4" }, { id: "phi-3.5", label: "Phi-3.5" } ] },
];
const FREE_MODEL_COUNT = FREE_MODEL_GROUPS.reduce((n, g) => n + g.models.length, 0);

// Bring-your-own-key models. Gemini deliberately lists only Flash-tier
// models — per Google AI Studio guidance, these are the best fit for a
// personal AI Studio API key (generous free-tier quota, low latency);
// Pro-tier models are better suited to paid/Vertex AI billing, so they're
// left off this list on purpose.
const BYOK_MODELS = {
  claude: [
    { id: "claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
  gpt: [
    { id: "gpt-5.5", label: "GPT-5.5" },
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "o4-mini", label: "o4-mini" },
  ],
  gemini: [
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  ],
};

const MODELS = { free: FREE_MODEL_GROUPS, freeCount: FREE_MODEL_COUNT, byok: BYOK_MODELS };

// Kept as an async no-op so main.js's existing `await loadCatalog()` still
// works unchanged — there's simply nothing to fetch anymore.
export async function loadCatalog() {
  return { techniques: TECHNIQUES, models: MODELS };
}

export function getTechniques() {
  return TECHNIQUES;
}
export function getTechniqueById(id) {
  return TECHNIQUES_BY_ID[id];
}
export function getModels() {
  return MODELS;
}

export function conventionForFreeModel(modelId) {
  const group = FREE_MODEL_GROUPS.find((g) => g.models.some((m) => m.id === modelId));
  return group ? group.convention : "universal";
}

export function currentModelLabel(modelChoice) {
  if (modelChoice.mode === "byok") {
    const list = BYOK_MODELS[modelChoice.byokProvider] || [];
    const model = list.find((m) => m.id === modelChoice.byokModel);
    return (model ? model.label : modelChoice.byokModel) + " · your key";
  }
  const group = FREE_MODEL_GROUPS.find((g) => g.models.some((m) => m.id === modelChoice.free));
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

// --- prompt assembly ------------------------------------------------------

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

// --- linter ----------------------------------------------------------------

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

// --- misc text utilities ----------------------------------------------------

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
