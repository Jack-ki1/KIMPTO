// ============================================================
// KIMPTO — storage.js
// localStorage persistence for settings + generation history.
// ============================================================

import { DEFAULT_SETTINGS, HISTORY_KEY, SETTINGS_KEY, MAX_HISTORY } from "./config.js";

export function loadSettings(){
  try{
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return Object.assign({}, DEFAULT_SETTINGS, stored);
  }catch(e){
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings){
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch(e){ /* storage unavailable — degrade silently, settings just won't persist */ }
}

export function loadHistory(){
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    // Ensure history items have the 'versions' property after the update
    return parsed.map(item => ({
      ...item,
      versions: item.versions || {} // Provide empty object if 'versions' is missing
    })).slice(0, MAX_HISTORY);
  } catch (e) {
    console.warn("Could not parse history from localStorage, returning empty array.", e);
    return [];
  }
}

export function saveHistory(arr){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, MAX_HISTORY)));
}
