// storage.js — thin localStorage wrapper. Everything Kimpto remembers
// (session history, the saved-prompt library, model choice, generation
// settings) lives only in the visitor's own browser; this is a static
// site with no server at all, so there's nowhere else it could go.
// Wrapped in try/catch throughout since
// localStorage can throw in private-browsing modes or when full.

const KEY = "kimpto_state_v1";

const DEFAULTS = {
  sessions: [],
  library: [
    {
      id: "seed-1",
      title: "SEO blog outline",
      prompt:
        "You are a senior SEO content strategist. Produce a 6-section blog outline for {{topic}} targeting {{audience}}, with an H1, meta description under 155 characters.",
      techniqueLabel: "Role-Based & Detailed",
      tags: ["marketing", "starter"],
      ts: Date.now(),
    },
  ],
  currentThread: [],
  modelChoice: { mode: "free", free: "claude-sonnet-5", byokProvider: "claude", byokModel: "claude-sonnet-5", byokKey: "" },
  selectedTech: ["direct", "role"],
  settings: {
    length: "standard",
    contentType: "General",
    language: "English",
    tone: "Neutral",
    markdown: false,
    negativeConstraints: "",
    autoSpeak: false,
  },
  colorMode: null, // null = follow system preference until the user picks explicitly
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function saveState(state) {
  try {
    // Never persist a BYOK key across page loads — re-entering it each
    // session is a small price for not leaving it sitting in localStorage.
    const toSave = { ...state, modelChoice: { ...state.modelChoice, byokKey: "" } };
    localStorage.setItem(KEY, JSON.stringify(toSave));
  } catch (e) {
    /* best effort — storage may be full or unavailable */
  }
}
