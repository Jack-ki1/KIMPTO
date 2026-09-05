// ============================================================
// KIMPTO — main.js
// Wires everything together: loads persisted state, applies it
// to the DOM, and orchestrates the generate() flow.
// ============================================================

import {
  PUTER_MODELS, GEMINI_MODELS, GROQ_MODELS,
  buildSystemPrompt, buildUserMessage, DEFAULT_SETTINGS
} from "./config.js";
import { loadSettings, saveSettings, loadHistory, saveHistory } from "./storage.js";
import { callPuter, callGemini, callGroq, extractJSON } from "./engines.js";
import {
  renderThemeMenu, renderHistory, renderResults, skeletonHTML,
  renderConsole, copyToClipboard
} from "./ui.js";

const $ = (id) => document.getElementById(id);

let settings = loadSettings();
let history = loadHistory();

const els = {
  html: document.documentElement,
  themeBtn: $("themeBtn"), themeMenu: $("themeMenu"),
  consoleBtn: $("consoleBtn"), consoleLaunch: $("consoleLaunch"),
  console: $("console"), consoleBackdrop: $("consoleBackdrop"), consoleClose: $("consoleClose"),
  consoleBody: $("consoleBody"),
  vu: $("vu"), statusDot: $("statusDot"), statusText: $("statusText"),

  tabFree: $("tabFree"), tabKey: $("tabKey"),
  freePanel: $("freePanel"), keyPanel: $("keyPanel"),
  puterModel: $("puterModel"), puterCustomField: $("puterCustomField"), puterCustomModel: $("puterCustomModel"),
  keyProvider: $("keyProvider"), keyModel: $("keyModel"), apiKeyInput: $("apiKeyInput"),
  historyList: $("historyList"),

  taskInput: $("taskInput"), constraintsInput: $("constraintsInput"), charCount: $("charCount"),
  generateBtn: $("generateBtn"),
  errorBanner: $("errorBanner"),
  skeletonZone: $("skeletonZone"), resultsZone: $("resultsZone"), placeholderZone: $("placeholderZone")
};

/* ---------------- PERSIST + APPLY ---------------- */

function persist(){ saveSettings(settings); }

function applyTheme(){
  els.html.setAttribute("data-theme", settings.theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  const bgVar = getComputedStyle(els.html).getPropertyValue("--bg").trim();
  if (meta && bgVar) meta.setAttribute("content", bgVar);
}
function applyDensity(){
  els.html.setAttribute("data-density", settings.density);
}

/* ---------------- SELECT POPULATION ---------------- */

function populateSelect(sel, items){
  sel.innerHTML = "";
  items.forEach(it => {
    const opt = document.createElement("option");
    if (typeof it === "string"){ opt.value = it; opt.textContent = it; }
    else { opt.value = it.id; opt.textContent = it.label; }
    sel.appendChild(opt);
  });
}

function renderEngineTabs(){
  const free = settings.engine === "free";
  els.tabFree.classList.toggle("active", free);
  els.tabKey.classList.toggle("active", !free);
  els.freePanel.style.display = free ? "" : "none";
  els.keyPanel.style.display = free ? "none" : "";
}

function renderKeyModelOptions(){
  const models = settings.keyProvider === "gemini" ? GEMINI_MODELS : GROQ_MODELS;
  populateSelect(els.keyModel, models);
  if (models.includes(settings.keyModel)) els.keyModel.value = settings.keyModel;
  else { els.keyModel.value = models[0]; settings.keyModel = models[0]; }
}

function setStatus(mode, label){
  els.statusDot.className = "status-dot" + (mode ? " " + mode : "");
  els.statusText.textContent = label;
  els.vu.classList.toggle("on", mode === "busy");
}

function updateCharCount(){
  els.charCount.textContent = els.taskInput.value.length + " characters";
}

/* ---------------- INIT ---------------- */

function init(){
  applyTheme();
  applyDensity();

  populateSelect(els.puterModel, PUTER_MODELS);
  els.puterModel.value = settings.puterModel || "";
  els.puterCustomModel.value = settings.puterCustomModel || "";
  els.puterCustomField.style.display = (els.puterModel.value === "__custom__") ? "" : "none";

  els.keyProvider.value = settings.keyProvider;
  renderKeyModelOptions();
  els.apiKeyInput.value = settings.keyProvider === "gemini" ? settings.geminiKey : settings.groqKey;

  renderEngineTabs();
  renderHistory(els.historyList, history, onHistorySelect);
  renderThemeMenu(els.themeMenu, settings.theme, onThemeSelect);
  renderConsole(els.consoleBody, settings, { onChange: onConsoleChange, onReset: onConsoleReset });

  updateCharCount();
  setStatus("", "idle");

  wireEvents();
}

function onHistorySelect(item){
  els.taskInput.value = item.task;
  els.constraintsInput.value = item.constraints || "";
  // Display the full prompt of the first version (or any specific one) in the task input if desired, otherwise just the task
  // For now, keeping it as task/constraints for context, results will be re-rendered if item.versions exist.
  updateCharCount();
  els.placeholderZone.style.display = "none";
  els.resultsZone.style.display = "";
  if (item.versions) {
    renderResults(els.resultsZone, item.versions);
  } else {
      // Fallback if versions are not saved, render empty or show a message
      els.resultsZone.innerHTML = '<div class="placeholder">Stored result details not available.</div>';
  }
}

function onThemeSelect(themeId){
  settings.theme = themeId;
  persist();
  applyTheme();
  renderThemeMenu(els.themeMenu, settings.theme, onThemeSelect);
  // keep the console's theme <select> in sync without a full console re-render
  const sel = document.getElementById("cThemeSelect");
  if (sel) sel.value = themeId;
  els.themeMenu.classList.remove("open");
}

function onConsoleChange(key, value){
  settings[key] = value;
  persist();
  if (key === "theme") applyTheme();
  if (key === "density") applyDensity();
  if (key === "theme") renderThemeMenu(els.themeMenu, settings.theme, onThemeSelect);
}

function onConsoleReset(){
  const keep = { engine: settings.engine, puterModel: settings.puterModel, puterCustomModel: settings.puterCustomModel,
    keyProvider: settings.keyProvider, keyModel: settings.keyModel, geminiKey: settings.geminiKey, groqKey: settings.groqKey };
  settings = Object.assign({}, DEFAULT_SETTINGS, keep);
  persist();
  applyTheme();
  applyDensity();
  renderThemeMenu(els.themeMenu, settings.theme, onThemeSelect);
  renderConsole(els.consoleBody, settings, { onChange: onConsoleChange, onReset: onConsoleReset });
}

/* ---------------- EVENTS ---------------- */

function wireEvents(){
  els.tabFree.addEventListener("click", () => { settings.engine = "free"; persist(); renderEngineTabs(); });
  els.tabKey.addEventListener("click", () => { settings.engine = "key"; persist(); renderEngineTabs(); });

  els.puterModel.addEventListener("change", () => {
    settings.puterModel = els.puterModel.value;
    els.puterCustomField.style.display = (els.puterModel.value === "__custom__") ? "" : "none";
    persist();
  });
  els.puterCustomModel.addEventListener("input", () => {
    settings.puterCustomModel = els.puterCustomModel.value.trim();
    persist();
  });

  els.keyProvider.addEventListener("change", () => {
    settings.keyProvider = els.keyProvider.value;
    renderKeyModelOptions();
    els.apiKeyInput.value = settings.keyProvider === "gemini" ? settings.geminiKey : settings.groqKey;
    persist();
  });
  els.keyModel.addEventListener("change", () => { settings.keyModel = els.keyModel.value; persist(); });
  els.apiKeyInput.addEventListener("input", () => {
    if (settings.keyProvider === "gemini") settings.geminiKey = els.apiKeyInput.value.trim();
    else settings.groqKey = els.apiKeyInput.value.trim();
    persist();
  });

  els.taskInput.addEventListener("input", updateCharCount);
  els.generateBtn.addEventListener("click", generate);
  els.taskInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
  });

  els.themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.themeMenu.classList.toggle("open");
  });
  document.addEventListener("click", () => els.themeMenu.classList.remove("open"));
  els.themeMenu.addEventListener("click", (e) => e.stopPropagation());

  const openConsole = () => { els.console.classList.add("open"); els.consoleBackdrop.classList.add("open"); };
  const closeConsole = () => { els.console.classList.remove("open"); els.consoleBackdrop.classList.remove("open"); };
  els.consoleBtn.addEventListener("click", openConsole);
  els.consoleLaunch.addEventListener("click", openConsole);
  els.consoleClose.addEventListener("click", closeConsole);
  els.consoleBackdrop.addEventListener("click", closeConsole);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeConsole(); });
}

/* ---------------- GENERATE ---------------- */

function showError(msg){ els.errorBanner.textContent = msg; els.errorBanner.classList.add("show"); }
function hideError(){ els.errorBanner.classList.remove("show"); els.errorBanner.textContent = ""; }

function setLoading(isLoading){
  els.generateBtn.disabled = isLoading;
  els.generateBtn.classList.toggle("loading", isLoading);
  if (isLoading){
    els.placeholderZone.style.display = "none";
    els.resultsZone.style.display = "none";
    els.skeletonZone.style.display = "";
    els.skeletonZone.innerHTML = skeletonHTML();
  } else {
    els.skeletonZone.style.display = "none";
  }
}

async function generate(){
  const task = els.taskInput.value.trim();
  if (!task){
    showError("Describe the task you want a prompt for first.");
    els.taskInput.focus();
    return;
  }
  if (settings.engine === "key"){
    const needsKey = settings.keyProvider === "gemini" ? settings.geminiKey : settings.groqKey;
    if (!needsKey){
      showError("Add an API key in the sidebar, or switch to the Free lane.");
      return;
    }
  }

  const constraints = els.constraintsInput.value.trim();
  const userMessage = buildUserMessage(task, constraints);
  const systemPrompt = buildSystemPrompt(settings);

  setLoading(true);
  hideError();
  setStatus("busy", "generating…");

  try{
    let raw;
    if (settings.engine === "free"){
      raw = await callPuter(systemPrompt, userMessage, settings);
    } else if (settings.keyProvider === "gemini"){
      raw = await callGemini(systemPrompt, userMessage, settings);
    } else {
      raw = await callGroq(systemPrompt, userMessage, settings);
    }

    const parsed = extractJSON(raw);
    els.placeholderZone.style.display = "none";
    els.resultsZone.style.display = "";
    renderResults(els.resultsZone, parsed);

    if (settings.autoCopy){
      const target = parsed[settings.autoCopyVersion];
      if (target && target.prompt) await copyToClipboard(target.prompt, null);
    }

    // Save history item including the generated versions
    history.unshift({ task, constraints, versions: parsed, ts: Date.now() });
    history = history.slice(0, 8);
    saveHistory(history);
    renderHistory(els.historyList, history, onHistorySelect);

    setStatus("ok", "last: just now");
  }catch(err){
    showError(err && err.message ? err.message : "Something went wrong generating prompts.");
    setStatus("err", "failed");
  }finally{
    setLoading(false);
  }
}

init();

if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      /* offline shell caching is a nice-to-have — ignore failures */
    });
  });
}
