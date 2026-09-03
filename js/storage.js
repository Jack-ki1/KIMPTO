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
  try{ return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch(e){ return []; }
}

export function saveHistory(list){
  try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); }
  catch(e){ /* degrade silently */ }
}
