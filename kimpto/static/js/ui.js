// ui.js — every function that builds or updates DOM. main.js owns state
// and event wiring; this file only knows how to render a given state.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { getTechniques, getModels, currentModelLabel, lintPrompt, findVariables, resolveVariables, diffWords, TECH_ACCENTS, CONVENTION_META } from "./catalog.js";
import { voiceInputSupported, voiceOutputSupported } from "./voice.js";

/* ---------------- toasts ---------------- */

export function showToast(msg) {
  const container = document.getElementById("toastContainer");
  const el = h("div", { class: "toast", html: icon("check", 12) + " " + escapeHtml(msg) });
  container.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------------- sidebar ---------------- */

export function renderSidebar(state, handlers) {
  const root = document.getElementById("sidebarList");
  clear(root);

  const q = state.search.trim().toLowerCase();

  if (state.sidebarTab === "history") {
    const sessions = q ? state.sessions.filter((s) => s.title.toLowerCase().includes(q)) : state.sessions;
    if (sessions.length === 0) {
      root.appendChild(h("p", { class: "sidebar-empty" }, "No past generations yet."));
    }
    sessions.forEach((s) => {
      const row = h("div", { class: "session-row", onClick: () => handlers.openSession(s.id) }, [
        h("p", { class: "session-title", text: s.title }),
        h("button", { class: "row-delete", onClick: (e) => { e.stopPropagation(); handlers.deleteSession(s.id); }, html: icon("trash", 12) }),
      ]);
      root.appendChild(row);
    });
  } else {
    const items = q
      ? state.library.filter((it) => it.title.toLowerCase().includes(q) || it.tags.some((t) => t.includes(q)))
      : state.library;
    if (items.length === 0) {
      root.appendChild(h("p", { class: "sidebar-empty" }, "No saved prompts yet."));
    }
    items.forEach((item) => {
      const tagsRow = h(
        "div",
        { class: "lib-tags" },
        item.tags.map((t) => h("span", { class: "lib-tag", text: t }))
      );
      const card = h("div", { class: "lib-card" }, [
        h("div", { class: "lib-card-head" }, [
          h("p", { class: "lib-title", text: item.title }),
          h("button", { class: "row-delete", onClick: () => handlers.deleteLibraryItem(item.id), html: icon("trash", 12) }),
        ]),
        tagsRow,
        h("div", { class: "lib-actions" }, [
          h("button", { class: "chip-btn", onClick: () => handlers.copy(item.prompt, "Copied from library"), html: icon("check", 10) + " Copy" }),
        ]),
      ]);
      root.appendChild(card);
    });
  }

  const counterEl = document.getElementById("todayCounter");
  if (state.promptsToday > 0) {
    counterEl.hidden = false;
    counterEl.textContent = `${state.promptsToday} prompt${state.promptsToday > 1 ? "s" : ""} engineered today`;
  } else {
    counterEl.hidden = true;
  }

  document.getElementById("tabHistoryBtn").classList.toggle("active", state.sidebarTab === "history");
  document.getElementById("tabLibraryBtn").classList.toggle("active", state.sidebarTab === "library");
}

/* ---------------- composer ---------------- */

export function buildComposer(state, handlers, { showShuffle, showIndicator }) {
  const wrap = h("div", { class: "composer" });

  if (state.refineTarget) {
    wrap.appendChild(
      h("div", { class: "refine-chip", html: icon("settings", 12) + " Refining: " + escapeHtml(state.refineTarget.label) }, [
        h("button", { onClick: handlers.cancelRefine, html: icon("x", 12) }),
      ])
    );
  } else if (showIndicator) {
    const label = `${state.selectedTech.length} technique${state.selectedTech.length > 1 ? "s" : ""} · ${escapeHtml(currentModelLabel(state.modelChoice))}`;
    const btn = h("button", { class: "indicator-pill", onClick: handlers.openSettings, html: icon("settings", 10) + " " + label });
    wrap.appendChild(btn);
  }

  if (!state.refineTarget && state.showDetails) {
    const grid = h("div", { class: "details-grid" });
    ["role", "audience", "format", "constraints"].forEach((field) => {
      const input = h("input", {
        class: "text-input",
        placeholder: field[0].toUpperCase() + field.slice(1) + " (optional)",
        value: state.details[field] || "",
        oninput: (e) => handlers.setDetail(field, e.target.value),
      });
      grid.appendChild(input);
    });
    wrap.appendChild(grid);
  }

  const bar = h("div", { class: "composer-bar" });
  if (!state.refineTarget) {
    bar.appendChild(
      h("button", {
        class: "icon-btn",
        title: "Add role, audience, format, constraints",
        onClick: handlers.toggleDetails,
        html: icon("plus", 16),
      })
    );
  }

  const textarea = h("textarea", {
    id: "composerTextarea",
    class: "composer-input",
    rows: 1,
    placeholder: state.refineTarget ? "How should I adjust it? e.g. make it shorter, add a persona…" : "Describe what you want a prompt for…",
    value: state.composerText,
    oninput: (e) => {
      handlers.setComposerText(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
    },
    onkeydown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handlers.send();
      }
    },
  });
  bar.appendChild(textarea);

  if (!state.refineTarget && showShuffle) {
    bar.appendChild(h("button", { class: "icon-btn", title: "Surprise me", onClick: handlers.surpriseMe, html: icon("shuffle", 15) }));
  }

  const micBtn = h("button", {
    class: "icon-btn" + (state.listening ? " active" : ""),
    title: voiceInputSupported ? "Voice input" : "Voice input not available",
    style: voiceInputSupported ? "" : "opacity:.4",
    onClick: handlers.toggleListen,
    html: icon("mic", 16),
  });
  bar.appendChild(micBtn);

  const sendBtn = h("button", {
    class: "send-btn",
    disabled: state.isGenerating || !state.composerText.trim(),
    onClick: handlers.send,
    html: state.isGenerating ? '<span class="spinner"></span>' : icon("send", 15),
  });
  bar.appendChild(sendBtn);

  wrap.appendChild(bar);
  return wrap;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ---------------- thread / turns / cards ---------------- */

export function renderEmptyState(show) {
  document.getElementById("emptyState").hidden = !show;
  document.getElementById("threadArea").hidden = show;
}

export function renderThread(state, handlers) {
  const root = document.getElementById("threadArea");
  clear(root);

  state.currentThread.forEach((turn) => {
    root.appendChild(renderTurn(turn, state, handlers));
  });

  if (state.isGenerating) {
    root.appendChild(renderGeneratingPlaceholder(state));
  }

  if (state.error) {
    root.appendChild(h("div", { class: "error-banner show", html: icon("alert", 13) + " " + escapeHtml(state.error) }));
  }

  root.appendChild(h("div", { id: "threadEnd" }));
  document.getElementById("threadEnd").scrollIntoView({ behavior: "smooth" });
}

function renderGeneratingPlaceholder(state) {
  const wrap = h("div", { class: "turn" });
  wrap.appendChild(h("div", { class: "bubble user-bubble" }, "…"));
  const grid = h("div", { class: "card-grid", style: gridCols(Math.min(3, state.selectedTech.length)) });
  state.selectedTech.forEach(() => {
    const skel = h("div", { class: "card skeleton-card" });
    [100, 85, 90, 70].forEach((w) => skel.appendChild(h("div", { class: "skel-line", style: `width:${w}%` })));
    grid.appendChild(skel);
  });
  wrap.appendChild(grid);
  if (state.genProgress) wrap.appendChild(h("p", { class: "muted small" }, state.genProgress));
  return wrap;
}

function gridCols(n) {
  return `grid-template-columns:repeat(${Math.max(1, n)},minmax(0,1fr))`;
}

function renderTurn(turn, state, handlers) {
  const techniques = getTechniques();
  const resultsList = techniques.filter((t) => turn.results[t.id]).map((t) => ({ tech: t, entry: turn.results[t.id] }));
  const compareIds = state.compareState[turn.id] || [];

  const wrap = h("div", { class: "turn" });
  wrap.appendChild(h("div", { class: "bubble user-bubble", text: turn.task }));

  if (turn.modelLabel) {
    const metaRow = h("div", { class: "turn-meta" }, [h("span", { class: "model-pill", text: turn.modelLabel })]);
    if (resultsList.length > 1) {
      metaRow.appendChild(
        h("button", { class: "text-btn", onClick: () => handlers.copyAll(turn, resultsList), html: icon("check", 10) + " Copy all" })
      );
    }
    wrap.appendChild(metaRow);
  }

  const grid = h("div", { class: "card-grid", style: gridCols(Math.min(3, resultsList.length)) });
  resultsList.forEach(({ tech, entry }) => {
    grid.appendChild(renderCard(turn, tech, entry, state, handlers));
  });
  wrap.appendChild(grid);

  if (compareIds.length === 2) {
    wrap.appendChild(
      h("button", { class: "compare-cta", onClick: () => handlers.openCompare(turn.id), html: icon("chevronDown", 13) + " Compare selected" })
    );
  }

  return wrap;
}

function renderCard(turn, tech, entry, state, handlers) {
  const idx = getTechniques().findIndex((t) => t.id === tech.id);
  const accent = TECH_ACCENTS[idx % TECH_ACCENTS.length];
  const lint = lintPrompt(entry.prompt);
  const vars = findVariables(entry.prompt);
  const key = turn.id + ":" + tech.id;
  const resolved = state.showResolved[key];
  const displayText = resolved ? resolveVariables(entry.prompt, state.varValues[key] || {}) : entry.prompt;
  const tr = state.testRuns[key] || {};
  const inCompare = (state.compareState[turn.id] || []).includes(tech.id);
  const isRefining = state.refineTarget && state.refineTarget.turnId === turn.id && state.refineTarget.techId === tech.id;
  const isSpeaking = state.speakingId === key;

  const card = h("div", { class: "card", style: `border-top-color:${accent};` + (isRefining ? `border-color:${accent}` : "") });

  const head = h("div", { class: "card-head" });
  const headTop = h("div", { class: "card-head-top" }, [
    h("span", { class: "card-tag", style: `color:${accent}`, text: entry.label.toUpperCase() }),
    renderScoreCluster(lint),
  ]);
  head.appendChild(headTop);
  if (entry.rationale) head.appendChild(h("p", { class: "card-rationale", text: entry.rationale }));

  const actions = h("div", { class: "card-actions" });
  actions.appendChild(actionBtn("Copy", () => handlers.copy(displayText, "Copied")));
  actions.appendChild(actionBtn("Save", () => handlers.saveToLibrary(entry)));
  actions.appendChild(actionBtn("Test", () => handlers.toggleTestRun(turn.id, tech.id)));
  actions.appendChild(actionBtn("Code", () => handlers.copy(handlers.codeSnippet(entry.prompt), "Copied as Python")));
  actions.appendChild(actionBtn("Compare", () => handlers.toggleCompare(turn.id, tech.id), inCompare, accent));
  actions.appendChild(actionBtn("Refine", () => handlers.startRefine(turn.id, tech.id, entry.label), isRefining, accent));
  if (voiceOutputSupported) {
    actions.appendChild(actionBtn(isSpeaking ? "Stop" : "Listen", () => handlers.toggleSpeak(key, entry.prompt), isSpeaking, accent));
  }
  head.appendChild(actions);
  card.appendChild(head);

  card.appendChild(h("div", { class: "card-body", text: displayText }));

  if (vars.length > 0) {
    const varsWrap = h("div", { class: "card-vars" });
    const toggleLabel = `${resolved ? "Hide" : "Fill"} ${vars.length} variable${vars.length > 1 ? "s" : ""}`;
    const toggle = h("button", { class: "text-btn", onClick: () => handlers.toggleResolved(key), html: icon("chevronDown", 11) + " " + toggleLabel });
    varsWrap.appendChild(toggle);
    if (resolved) {
      const fields = h("div", { class: "var-fields" });
      vars.forEach((v) => {
        fields.appendChild(
          h("input", {
            class: "text-input small",
            placeholder: v,
            value: (state.varValues[key] || {})[v] || "",
            oninput: (e) => handlers.setVarValue(key, v, e.target.value),
          })
        );
      });
      varsWrap.appendChild(fields);
    }
    card.appendChild(varsWrap);
  }

  if (lint.tips[0]) {
    card.appendChild(h("div", { class: "card-tip", title: lint.tips[0] }, lint.tips[0].length > 60 ? lint.tips[0].slice(0, 60) + "…" : lint.tips[0]));
  }

  if (tr.open) {
    const trWrap = h("div", { class: "test-run-panel" });
    trWrap.appendChild(
      h("input", {
        class: "text-input",
        placeholder: "Sample input to test with…",
        value: tr.input || "",
        oninput: (e) => handlers.setTestRunInput(turn.id, tech.id, e.target.value),
      })
    );
    const runBtn = h(
      "button",
      { class: "run-btn", disabled: tr.running, onClick: () => handlers.runTest(turn.id, tech.id, entry.prompt) },
      tr.running ? "Running…" : "Run test"
    );
    trWrap.appendChild(runBtn);
    if (tr.error) trWrap.appendChild(h("p", { class: "error-text", text: tr.error }));
    if (tr.output) trWrap.appendChild(h("div", { class: "test-output", text: tr.output }));
    card.appendChild(trWrap);
  }

  return card;
}

function renderScoreCluster(lint) {
  const wrap = h("div", { class: "score-cluster" });
  const dots = h("div", { class: "checklist-dots" });
  [
    ["persona", "Persona"],
    ["format", "Format"],
    ["constraints", "Constraints"],
    ["length", "Length"],
  ].forEach(([key, label]) => {
    dots.appendChild(
      h("span", {
        class: "dot" + (lint.checks[key] ? " on" : ""),
        title: (lint.checks[key] ? "Has " : "Missing ") + label.toLowerCase(),
      })
    );
  });
  wrap.appendChild(dots);
  const color = lint.score >= 75 ? "var(--success)" : lint.score >= 50 ? "#f59e0b" : "var(--danger)";
  wrap.appendChild(h("span", { class: "score-badge", style: `color:${color};border-color:${color}55;background:${color}16`, text: `${lint.score}/100` }));
  return wrap;
}

function actionBtn(label, onClick, active, accent) {
  return h("button", {
    class: "chip-btn" + (active ? " active" : ""),
    style: active && accent ? `border-color:${accent};color:${accent}` : "",
    onClick,
    text: label,
  });
}

/* ---------------- settings drawer ---------------- */

export function renderSettings(state, handlers) {
  const root = document.getElementById("settingsBody");
  clear(root);
  const models = getModels();
  if (!models) return;

  // --- Model section ---
  const modelSection = h("div", { class: "settings-section" });
  const modelHead = h("div", { class: "settings-head-row" }, [
    h("h3", { class: "settings-label", text: "MODEL" }),
    h("span", { class: "convention-pill", text: `${CONVENTION_META[handlers.getConvention()].mark} ${CONVENTION_META[handlers.getConvention()].label} formatting` }),
  ]);
  modelSection.appendChild(modelHead);

  const modeTabs = h("div", { class: "segmented" }, [
    h("button", {
      class: state.modelChoice.mode === "free" ? "active" : "",
      onClick: () => handlers.setModelMode("free"),
      html: icon("server", 12) + ` Free (${models.freeCount})`,
    }),
    h("button", {
      class: state.modelChoice.mode === "byok" ? "active" : "",
      onClick: () => handlers.setModelMode("byok"),
      html: icon("key", 12) + " My API key",
    }),
  ]);
  modelSection.appendChild(modeTabs);

  if (state.modelChoice.mode === "free") {
    const list = h("div", { class: "free-model-list" });
    models.free.forEach((group) => {
      const groupHead = h("div", { class: "free-group-head" }, [
        h("p", { class: "free-group-name", style: `color:${group.accent}`, text: group.name }),
        h("p", { class: "free-group-blurb", text: group.blurb }),
      ]);
      list.appendChild(groupHead);
      const rows = h("div", { class: "free-group-rows" });
      group.models.forEach((m) => {
        const selected = state.modelChoice.free === m.id;
        rows.appendChild(
          h("button", { class: "free-model-row" + (selected ? " selected" : ""), onClick: () => handlers.setFreeModel(m.id) }, [
            h("span", { text: m.label }),
            selected ? h("span", { style: `color:${group.accent}`, html: icon("check", 12) }) : null,
          ])
        );
      });
      list.appendChild(rows);
    });
    modelSection.appendChild(list);
  } else {
    const providerRow = h("div", { class: "provider-row" });
    ["claude", "gpt", "gemini"].forEach((p) => {
      const btn = h(
        "button",
        {
          class: "provider-btn" + (state.modelChoice.byokProvider === p ? " selected" : ""),
          onClick: () => handlers.setByokProvider(p),
        },
        `${CONVENTION_META[p].mark} ${CONVENTION_META[p].label}`
      );
      providerRow.appendChild(btn);
    });
    modelSection.appendChild(providerRow);

    const select = h("select", { class: "select-input", onchange: (e) => handlers.setByokModel(e.target.value) });
    (models.byok[state.modelChoice.byokProvider] || []).forEach((m) => {
      select.appendChild(h("option", { value: m.id, selected: m.id === state.modelChoice.byokModel ? "" : undefined }, m.label));
    });
    modelSection.appendChild(select);

    modelSection.appendChild(
      h("input", {
        class: "text-input",
        type: "password",
        placeholder: "Paste your API key",
        value: state.modelChoice.byokKey,
        oninput: (e) => handlers.setByokKey(e.target.value),
      })
    );
    modelSection.appendChild(h("p", { class: "muted small" }, "Stored only in your browser for this session — never sent to Kimpto's servers, and cleared automatically on reload."));
  }
  root.appendChild(modelSection);
  root.appendChild(h("hr", { class: "settings-divider" }));

  // --- Techniques ---
  const techSection = h("div", { class: "settings-section" });
  techSection.appendChild(h("h3", { class: "settings-label", text: `TECHNIQUES (${state.selectedTech.length} selected)` }));
  const chipRow = h("div", { class: "chip-row" });
  getTechniques().forEach((t, idx) => {
    const active = state.selectedTech.includes(t.id);
    const accent = TECH_ACCENTS[idx % TECH_ACCENTS.length];
    const chip = h("button", {
      class: "tech-chip" + (active ? " active" : ""),
      style: active ? `border-color:${accent};color:${accent};background:${accent}1c` : "",
      title: `${t.short} (${t.principle})`,
      onClick: () => handlers.toggleTechnique(t.id),
      text: t.label,
    });
    chipRow.appendChild(chip);
  });
  techSection.appendChild(chipRow);
  root.appendChild(techSection);
  root.appendChild(h("hr", { class: "settings-divider" }));

  // --- Generation options ---
  const genSection = h("div", { class: "settings-section" });
  genSection.appendChild(h("h3", { class: "settings-label", text: "GENERATION" }));

  genSection.appendChild(labeledField("Length", h("div", { class: "segmented" }, ["short", "standard", "long"].map((l) =>
    h("button", { class: state.settings.length === l ? "active" : "", onClick: () => handlers.setSetting("length", l), text: l })
  ))));

  genSection.appendChild(labeledField("Content type", selectFor(["General", "Marketing copy", "Code / technical", "Data analysis", "Customer support", "Creative writing"], state.settings.contentType, (v) => handlers.setSetting("contentType", v))));
  genSection.appendChild(labeledField("Output language", selectFor(["English", "Spanish", "French", "Swahili", "German", "Portuguese"], state.settings.language, (v) => handlers.setSetting("language", v))));
  genSection.appendChild(labeledField("Tone", selectFor(["Neutral", "Friendly", "Formal", "Playful", "Authoritative"], state.settings.tone, (v) => handlers.setSetting("tone", v))));
  genSection.appendChild(
    labeledField(
      "Negative constraints",
      h("input", { class: "text-input", value: state.settings.negativeConstraints, placeholder: "e.g. jargon, passive voice", oninput: (e) => handlers.setSetting("negativeConstraints", e.target.value) })
    )
  );
  genSection.appendChild(toggleField("Markdown formatting", state.settings.markdown, (v) => handlers.setSetting("markdown", v)));
  genSection.appendChild(toggleField("Read first result aloud automatically", state.settings.autoSpeak, (v) => handlers.setSetting("autoSpeak", v)));
  if (!voiceOutputSupported) genSection.appendChild(h("p", { class: "muted small" }, "Voice output isn't available in this browser."));

  root.appendChild(genSection);
}

function selectFor(options, value, onChange) {
  const select = h("select", { class: "select-input", onchange: (e) => onChange(e.target.value) });
  options.forEach((opt) => select.appendChild(h("option", { value: opt, selected: opt === value ? "" : undefined }, opt)));
  return select;
}
function labeledField(label, control) {
  return h("div", { class: "field" }, [h("label", { class: "field-label", text: label }), control]);
}
function toggleField(label, checked, onChange) {
  return h("label", { class: "toggle-row" }, [
    label,
    h("input", { type: "checkbox", checked: checked ? "" : undefined, onchange: (e) => onChange(e.target.checked) }),
  ]);
}

/* ---------------- compare modal ---------------- */

export function renderCompareModal(turn, entry1, entry2) {
  const backdrop = h("div", { class: "modal-backdrop", onClick: (e) => { if (e.target === backdrop) closeCompareModal(); } });
  const diffHtml = diffWords(entry1.prompt, entry2.prompt)
    .map((d) => {
      if (d.type === "same") return escapeHtml(d.text);
      if (d.type === "added") return `<span class="diff-added">${escapeHtml(d.text)}</span>`;
      return `<span class="diff-removed">${escapeHtml(d.text)}</span>`;
    })
    .join("");

  const modal = h("div", { class: "modal" }, [
    h("div", { class: "modal-head" }, [
      h("h2", { text: `${entry1.label} vs ${entry2.label}` }),
      h("button", { onClick: closeCompareModal, html: icon("x", 16) }),
    ]),
    h("p", { class: "muted small" }, "Word-level diff — additions highlighted, removals struck through."),
    h("div", { class: "diff-box", html: diffHtml }),
  ]);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function closeCompareModal() {
  document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
}
