// ============================================================
// KIMPTO — config.js
// Model rosters, customization option tables, and the function
// that turns the current settings into a system prompt.
// ============================================================

export const PUTER_MODELS = [
  { id: "", label: "Default (Puter's pick)" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano (fast)" },
  { id: "anthropic/claude-opus-5", label: "Claude Opus 5" },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "x-ai/grok-4.6", label: "Grok 4.6" },
  { id: "__custom__", label: "Custom model id…" }
];

export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
export const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

export const THEMES = [
  { id: "graphite", label: "Graphite", swatch: "#e0a82e" },
  { id: "daybreak", label: "Daybreak", swatch: "#4a3f8a" },
  { id: "phosphor", label: "Phosphor", swatch: "#3dff8a" },
  { id: "aurora",   label: "Aurora",   swatch: "#ff5cb8" }
];

export const CONTENT_TYPES = [
  { id: "general",   label: "General" },
  { id: "code",      label: "Code & Engineering" },
  { id: "writing",   label: "Creative Writing" },
  { id: "marketing", label: "Marketing & Copy" },
  { id: "data",      label: "Data & Analytics" },
  { id: "image",     label: "Image-Gen Prompts" },
  { id: "academic",  label: "Academic & Research" }
];

export const LANGUAGES = [
  "English", "Kiswahili", "French", "Spanish", "Arabic",
  "Portuguese", "German", "Hindi", "Custom…"
];

export const TONES = ["Neutral", "Formal", "Casual", "Persuasive", "Technical"];

export const LENGTHS = [
  { id: "short",    label: "Short" },
  { id: "standard", label: "Standard" },
  { id: "long",     label: "Long" }
];

const LENGTH_SPECS = {
  short:    { v1: 25,  v2: 90,  v3: 80  },
  standard: { v1: 40,  v2: 160, v3: 130 },
  long:     { v1: 70,  v2: 260, v3: 220 }
};

const DOMAIN_LINES = {
  general:  "General-purpose — no specific field vocabulary required.",
  code:     "Software engineering — use developer vocabulary (functions, edge cases, tests, error handling).",
  writing:  "Creative writing — use literary/narrative vocabulary (voice, pacing, imagery, structure).",
  marketing:"Marketing & copywriting — use persuasive/brand vocabulary (audience, hook, CTA, positioning).",
  data:     "Data & analytics — use analytical vocabulary (metrics, segments, assumptions, caveats).",
  image:    "Image-generation prompting — use visual vocabulary (composition, lighting, style, medium, camera).",
  academic: "Academic & research — use scholarly vocabulary (methodology, evidence, citation, rigor)."
};

export const DEFAULT_SETTINGS = {
  engine: "free",
  puterModel: "",
  puterCustomModel: "",
  keyProvider: "gemini",
  keyModel: GEMINI_MODELS[0],
  geminiKey: "",
  groqKey: "",

  theme: "graphite",
  density: "comfortable",

  length: "standard",
  contentType: "general",
  language: "English",
  customLanguage: "",
  tone: "Neutral",
  markup: "plain",

  creativity: 0.9,
  fewshotDepth: 1,
  personaIntensity: "light",
  negativeConstraints: "",

  autoCopy: false,
  autoCopyVersion: "version_2"
};

export function buildSystemPrompt(s){
  const L = LENGTH_SPECS[s.length] || LENGTH_SPECS.standard;
  const domainLine = DOMAIN_LINES[s.contentType] || DOMAIN_LINES.general;
  const languageName = (s.language === "Custom…" ? (s.customLanguage || "English") : s.language) || "English";
  const personaLine = s.personaIntensity === "deep"
    ? "Assign a deeply specific persona: a named sub-specialty, years of experience, and a concrete stake in getting the task right."
    : "Assign a brief, one-line expert persona — no backstory.";
  const fewshotLine = s.fewshotDepth >= 2
    ? "Include TWO short example pairs (sample input -> desired output)."
    : "Include ONE short example pair (sample input -> desired output).";
  const markupLine = s.markup === "markdown"
    ? "Write each generated prompt's text using light markdown (bold, bullet lists) where it genuinely helps."
    : "Write each generated prompt as plain text — no markdown formatting.";
  const negativeLine = s.negativeConstraints && s.negativeConstraints.trim()
    ? "Across all three versions, make sure the instructions steer away from: " + s.negativeConstraints.trim() + "."
    : "";
  const toneLine = s.tone && s.tone !== "Neutral"
    ? "Write the prompts themselves in a " + s.tone.toLowerCase() + " register."
    : "";

  return [
    "You are Kimpto, a prompt-engineering engine.",
    "Given a user's raw task description (and optional constraints), generate EXACTLY three prompts that solve the same underlying task using three different, INCOMPATIBLE construction methods.",
    "Never produce three reworded versions of the same prompt. Each version must obey its own structural rules below — breaking a version's rules is a failure.",
    "",
    "Domain framing: " + domainLine,
    "Write the prompt TEXT ITSELF entirely in " + languageName + ". (Keep the JSON keys and labels exactly as specified below, in English, so the app can parse them.)",
    toneLine,
    negativeLine,
    "",
    "VERSION 1 — Direct & Concise",
    "- A single, pure imperative instruction.",
    "- Hard limit: " + L.v1 + " words maximum.",
    "- FORBIDDEN: persona/role assignment, numbered steps, examples, background context.",
    "- Purpose: the fastest instruction a busy expert could paste in and get a usable result immediately.",
    "",
    "VERSION 2 — Role-Based & Detailed",
    "- MUST open by assigning the model an expert persona (\"You are a...\"). " + personaLine,
    "- MUST include a numbered, step-by-step breakdown of at least 3 steps.",
    "- MUST specify an explicit output format or structure.",
    "- Target length: roughly " + L.v2 + " words.",
    "- Purpose: a context-heavy brief a specialist would follow.",
    "",
    "VERSION 3 — Creative & Advanced",
    "- MUST include at least one {{variable}} placeholder the user can swap out.",
    "- " + fewshotLine,
    "- MUST reframe the task from an angle not used in Versions 1 or 2.",
    "- Target length: roughly " + L.v3 + " words.",
    "- Purpose: a reusable, advanced template for repeated use.",
    "",
    markupLine,
    "",
    "Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:",
    '{"version_1":{"label":"Direct & Concise","prompt":"..."},"version_2":{"label":"Role-Based & Detailed","prompt":"..."},"version_3":{"label":"Creative & Advanced","prompt":"..."}}'
  ].filter(Boolean).join("\n");
}

export function buildUserMessage(task, constraints){
  return constraints
    ? "Task: " + task + "\nConstraints/context: " + constraints
    : "Task: " + task;
}

export const VERSION_META = {
  version_1: { tag: "DIRECT & CONCISE", cls: "v1" },
  version_2: { tag: "ROLE-BASED & DETAILED", cls: "v2" },
  version_3: { tag: "CREATIVE & ADVANCED", cls: "v3" }
};

export const HISTORY_KEY = "kimpto_history_v2";
export const SETTINGS_KEY = "kimpto_settings_v2";
export const MAX_HISTORY = 8;
