// main.js — application state + event wiring. Rendering itself lives in
// ui.js; this file decides *when* to re-render and *what* the state is.

import { loadCatalog, deriveConvention, uid, getModels, currentModelLabel } from "./catalog.js";
import * as api from "./api.js";
import * as voice from "./voice.js";
import { loadState, saveState } from "./storage.js";
import * as ui from "./ui.js";
import { icon } from "./icons.js";

const persisted = loadState();

const state = {
  ...persisted,
  colorMode: persisted.colorMode || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  sidebarOpen: true,
  sidebarTab: "history",
  search: "",
  composerText: "",
  details: { role: "", audience: "", format: "", constraints: "" },
  showDetails: false,
  settingsOpen: false,
  isGenerating: false,
  genProgress: null,
  error: "",
  refineTarget: null,
  varValues: {},
  showResolved: {},
  testRuns: {},
  compareState: {},
  listening: false,
  speakingId: null,
  promptsToday: 0,
};

function persist() {
  saveState({
    sessions: state.sessions,
    library: state.library,
    currentThread: state.currentThread,
    modelChoice: state.modelChoice,
    selectedTech: state.selectedTech,
    settings: state.settings,
    colorMode: state.colorMode,
  });
}

function computePromptsToday() {
  const today = new Date().toDateString();
  const all = [...state.currentThread, ...state.sessions.flatMap((s) => s.thread)];
  state.promptsToday = all
    .filter((t) => new Date(t.ts).toDateString() === today)
    .reduce((n, t) => n + Object.keys(t.results).length, 0);
}

/* ---------------- render orchestration ---------------- */

function renderAll() {
  document.documentElement.setAttribute("data-color-mode", state.colorMode);
  document.getElementById("themeToggleBtn").innerHTML = state.colorMode === "light" ? icon("moon", 15) : icon("sun", 15);
  document.getElementById("sidebar").classList.toggle("collapsed", !state.sidebarOpen);

  computePromptsToday();
  ui.renderSidebar(state, handlers);

  const isEmpty = state.currentThread.length === 0;
  ui.renderEmptyState(isEmpty);

  mountComposer(isEmpty);

  if (!isEmpty) {
    ui.renderThread(state, handlers);
  }

  if (state.settingsOpen) ui.renderSettings(state, handlers);
  document.getElementById("settingsOverlay").hidden = !state.settingsOpen;

  persist();
}

function mountComposer(isEmpty) {
  const mount = document.getElementById(isEmpty ? "heroComposerMount" : "dockedComposerMount");
  const other = document.getElementById(isEmpty ? "dockedComposerMount" : "heroComposerMount");
  other.innerHTML = "";
  mount.innerHTML = "";
  mount.appendChild(ui.buildComposer(state, handlers, { showShuffle: isEmpty, showIndicator: !isEmpty }));
  document.getElementById("dockedComposerWrap").hidden = isEmpty;
  const textarea = document.getElementById("composerTextarea");
  if (textarea) textarea.focus();
}

/* ---------------- generate / refine ---------------- */

async function handleGenerate(taskText) {
  state.error = "";
  state.isGenerating = true;
  state.genProgress = null;
  renderAll();
  try {
    const merged = await api.generate({
      modelChoice: state.modelChoice,
      task: taskText,
      details: state.details,
      techniqueIds: state.selectedTech,
      settings: state.settings,
      onProgress: (msg) => {
        state.genProgress = msg;
        renderAll();
      },
    });
    const turn = {
      id: uid(),
      ts: Date.now(),
      task: taskText,
      details: { ...state.details },
      techniques: [...state.selectedTech],
      modelLabel: currentModelLabel(state.modelChoice),
      results: merged,
    };
    state.currentThread.push(turn);
    if (state.settings.autoSpeak && Object.values(merged)[0]) {
      handlers.toggleSpeak(turn.id + ":auto", Object.values(merged)[0].prompt);
    }
  } catch (e) {
    state.error = e.message || "Generation failed.";
  } finally {
    state.isGenerating = false;
    state.genProgress = null;
    renderAll();
  }
}

async function handleRefine(instructionText) {
  const { turnId, techId } = state.refineTarget;
  state.error = "";
  state.isGenerating = true;
  renderAll();
  try {
    const turn = state.currentThread.find((t) => t.id === turnId);
    const entry = turn.results[techId];
    const parsed = await api.refine({ modelChoice: state.modelChoice, entry, instruction: instructionText, settings: state.settings });
    turn.results[techId] = { ...entry, prompt: parsed.prompt, rationale: parsed.rationale || entry.rationale };
    ui.showToast("Updated");
  } catch (e) {
    state.error = e.message || "Refine failed.";
  } finally {
    state.isGenerating = false;
    state.refineTarget = null;
    renderAll();
  }
}

async function handleSend() {
  const text = state.composerText.trim();
  if (!text) return;
  state.composerText = "";
  if (state.refineTarget) await handleRefine(text);
  else await handleGenerate(text);
}

/* ---------------- handlers passed into ui.js ---------------- */

const handlers = {
  // sidebar
  openSession(sessId) {
    const sess = state.sessions.find((s) => s.id === sessId);
    if (!sess) return;
    state.sessions = state.sessions.filter((s) => s.id !== sessId);
    if (state.currentThread.length > 0) {
      state.sessions.unshift({ id: uid(), title: state.currentThread[0].task.slice(0, 48), ts: Date.now(), thread: state.currentThread });
    }
    state.currentThread = sess.thread;
    state.refineTarget = null;
    renderAll();
  },
  deleteSession(id) {
    state.sessions = state.sessions.filter((s) => s.id !== id);
    renderAll();
  },
  deleteLibraryItem(id) {
    state.library = state.library.filter((it) => it.id !== id);
    renderAll();
  },
  copy(text, label) {
    navigator.clipboard
      .writeText(text)
      .then(() => ui.showToast(label || "Copied"))
      .catch(() => ui.showToast("Copy failed"));
  },
  copyAll(turn, resultsList) {
    const block = resultsList.map(({ entry }) => `${entry.label.toUpperCase()}\n${entry.prompt}`).join("\n\n---\n\n");
    handlers.copy(block, "Copied all versions");
  },
  codeSnippet(promptText) {
    const esc = promptText.replace(/`/g, "\\`");
    return `import anthropic\n\nclient = anthropic.Anthropic(api_key="YOUR_KEY")\nresponse = client.messages.create(\n    model="claude-sonnet-4-5",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": """${esc}"""}],\n)\nprint(response.content[0].text)`;
  },

  // composer
  setComposerText(v) {
    state.composerText = v;
  },
  toggleDetails() {
    state.showDetails = !state.showDetails;
    renderAll();
  },
  setDetail(field, value) {
    state.details[field] = value;
  },
  cancelRefine() {
    state.refineTarget = null;
    renderAll();
  },
  send: () => { handleSend(); },
  surpriseMe() {
    const tasks = [
      "Summarize long customer support tickets into a 3-bullet action list for my team lead",
      "Write a compelling product description for a wireless noise-cancelling headphone",
      "Explain what might be causing a React useEffect infinite loop and how to fix it",
      "Draft a cold outreach email to a potential client introducing our design agency",
      "Create a 4-week study schedule for learning conversational Spanish",
      "Explain how blockchain works to a complete beginner",
      "Turn a messy meeting transcript into a clean summary with owners and deadlines",
      "Write a witty out-of-office reply for a two-week vacation",
    ];
    state.composerText = tasks[Math.floor(Math.random() * tasks.length)];
    renderAll();
  },
  toggleListen() {
    if (state.listening) {
      voice.stopListening();
      state.listening = false;
      renderAll();
      return;
    }
    voice.startListening(
      (transcript) => {
        state.composerText = transcript;
        const ta = document.getElementById("composerTextarea");
        if (ta) ta.value = transcript;
      },
      () => {
        state.listening = false;
        renderAll();
      },
      (msg) => ui.showToast(msg)
    );
    state.listening = true;
    renderAll();
  },
  openSettings() {
    state.settingsOpen = true;
    renderAll();
  },

  // cards
  toggleResolved(key) {
    state.showResolved[key] = !state.showResolved[key];
    renderAll();
  },
  setVarValue(key, name, value) {
    state.varValues[key] = { ...(state.varValues[key] || {}), [name]: value };
    renderAll();
  },
  saveToLibrary(entry) {
    state.library.unshift({
      id: uid(),
      title: entry.label,
      prompt: entry.prompt,
      techniqueLabel: entry.label,
      tags: [state.settings.contentType.toLowerCase()],
      ts: Date.now(),
    });
    ui.showToast("Saved to library");
    renderAll();
  },
  toggleTestRun(turnId, techId) {
    const key = turnId + ":" + techId;
    const cur = state.testRuns[key] || { open: false, input: "", running: false, output: "", error: "" };
    state.testRuns[key] = { ...cur, open: !cur.open };
    renderAll();
  },
  setTestRunInput(turnId, techId, value) {
    const key = turnId + ":" + techId;
    state.testRuns[key] = { ...(state.testRuns[key] || {}), input: value };
  },
  async runTest(turnId, techId, promptText) {
    const key = turnId + ":" + techId;
    state.testRuns[key] = { ...(state.testRuns[key] || {}), running: true, error: "", output: "" };
    renderAll();
    try {
      const sampleInput = (state.testRuns[key] || {}).input || "";
      const { output } = await api.testRun({ modelChoice: state.modelChoice, promptText, sampleInput });
      state.testRuns[key] = { ...state.testRuns[key], running: false, output };
    } catch (e) {
      state.testRuns[key] = { ...state.testRuns[key], running: false, error: e.message || "Test run failed." };
    }
    renderAll();
  },
  toggleCompare(turnId, techId) {
    const cur = state.compareState[turnId] || [];
    let next;
    if (cur.includes(techId)) next = cur.filter((x) => x !== techId);
    else if (cur.length >= 2) next = [cur[1], techId];
    else next = [...cur, techId];
    state.compareState[turnId] = next;
    renderAll();
  },
  openCompare(turnId) {
    const ids = state.compareState[turnId] || [];
    const turn = state.currentThread.find((t) => t.id === turnId);
    if (!turn || ids.length !== 2) return;
    const e1 = turn.results[ids[0]];
    const e2 = turn.results[ids[1]];
    if (!e1 || !e2) return;
    ui.renderCompareModal(turn, e1, e2);
  },
  startRefine(turnId, techId, label) {
    state.refineTarget = { turnId, techId, label };
    renderAll();
  },
  toggleSpeak(key, text) {
    if (state.speakingId === key) {
      voice.stopSpeaking();
      state.speakingId = null;
      renderAll();
      return;
    }
    const started = voice.speak(text, () => {
      state.speakingId = null;
      renderAll();
    });
    if (!started) {
      ui.showToast("Voice output isn't available");
      return;
    }
    state.speakingId = key;
    renderAll();
  },

  // settings
  getConvention: () => deriveConvention(state.modelChoice),
  setModelMode(mode) {
    state.modelChoice.mode = mode;
    renderAll();
  },
  setFreeModel(id) {
    state.modelChoice.free = id;
    renderAll();
  },
  setByokProvider(p) {
    state.modelChoice.byokProvider = p;
    const models = getModels();
    const firstModel = models && models.byok[p] && models.byok[p][0];
    if (firstModel) state.modelChoice.byokModel = firstModel.id;
    renderAll();
  },
  setByokModel(id) {
    state.modelChoice.byokModel = id;
  },
  setByokKey(v) {
    state.modelChoice.byokKey = v;
  },
  toggleTechnique(id) {
    if (state.selectedTech.includes(id)) {
      if (state.selectedTech.length > 1) state.selectedTech = state.selectedTech.filter((x) => x !== id);
    } else {
      state.selectedTech = [...state.selectedTech, id];
    }
    renderAll();
  },
  setSetting(key, value) {
    state.settings[key] = value;
    renderAll();
  },
};

/* ---------------- top-level chrome wiring ---------------- */

document.getElementById("sidebarToggleBtn").addEventListener("click", () => {
  state.sidebarOpen = !state.sidebarOpen;
  renderAll();
});
document.getElementById("themeToggleBtn").addEventListener("click", () => {
  state.colorMode = state.colorMode === "light" ? "dark" : "light";
  renderAll();
});
document.getElementById("settingsToggleBtn").addEventListener("click", () => {
  state.settingsOpen = true;
  renderAll();
});
document.getElementById("settingsCloseBtn").addEventListener("click", () => {
  state.settingsOpen = false;
  renderAll();
});
document.getElementById("settingsOverlay").addEventListener("click", (e) => {
  if (e.target.id === "settingsOverlay") {
    state.settingsOpen = false;
    renderAll();
  }
});
document.getElementById("newSessionBtn").addEventListener("click", () => {
  if (state.currentThread.length > 0) {
    state.sessions.unshift({ id: uid(), title: state.currentThread[0].task.slice(0, 48), ts: Date.now(), thread: state.currentThread });
  }
  state.currentThread = [];
  state.refineTarget = null;
  state.composerText = "";
  renderAll();
});
document.getElementById("sidebarSearch").addEventListener("input", (e) => {
  state.search = e.target.value;
  renderAll();
});
document.getElementById("tabHistoryBtn").addEventListener("click", () => {
  state.sidebarTab = "history";
  renderAll();
});
document.getElementById("tabLibraryBtn").addEventListener("click", () => {
  state.sidebarTab = "library";
  renderAll();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") {
    e.preventDefault();
    const ta = document.getElementById("composerTextarea");
    if (ta) ta.focus();
  }
});

/* ---------------- boot ---------------- */

(async function boot() {
  try {
    await loadCatalog();
  } catch (e) {
    document.getElementById("bootError").hidden = false;
    document.getElementById("bootError").textContent = "Couldn't load Kimpto's technique/model catalog from the server. Refresh to try again.";
    console.error(e);
    return;
  }
  renderAll();
})();
