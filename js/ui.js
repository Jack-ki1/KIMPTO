// ============================================================
// KIMPTO — ui.js
// Pure rendering functions. Each render* function rebuilds its
// slice of the DOM from current state and wires its own event
// handlers via the callbacks passed in — no hidden shared state.
// ============================================================

import {
  THEMES, CONTENT_TYPES, LANGUAGES, TONES, LENGTHS, VERSION_META
} from "./config.js";

/* ---------------- THEME MENU ---------------- */

export function renderThemeMenu(menuEl, currentTheme, onSelect){
  menuEl.innerHTML = "";
  THEMES.forEach(t => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = t.id === currentTheme ? "active" : "";
    btn.innerHTML = '<span class="theme-swatch" style="background:' + t.swatch + '"></span><span>' + t.label + "</span>";
    btn.addEventListener("click", () => onSelect(t.id));
    menuEl.appendChild(btn);
  });
}

/* ---------------- HISTORY ---------------- */

export function renderHistory(listEl, history, onSelect){
  if (!history.length){
    listEl.innerHTML = '<div class="history-empty">Nothing generated yet</div>';
    return;
  }
  listEl.innerHTML = "";
  history.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "history-item";
    btn.type = "button";
    // Use the first few words of the task as the main text, truncate if necessary
    let displayText = item.task || "";
    if (displayText.length > 60) {
        displayText = displayText.substring(0, 57) + '...';
    }
    btn.textContent = displayText;
    btn.title = item.task; // Show full task on hover
    btn.addEventListener("click", () => onSelect(item));
    listEl.appendChild(btn);
  });
}

/* ---------------- RESULTS / CARDS ---------------- */

function copyIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
}
function checkIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
}

export async function copyToClipboard(text, btn){
  let ok = false;
  try{
    if (navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  }catch(e){ ok = false; }
  if (!ok){
    try{
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      ok = true;
    }catch(e){ ok = false; }
  }
  if (ok && btn){
    const prevHTML = btn.innerHTML;
    btn.classList.add("copied");
    btn.innerHTML = checkIcon() + "<span>Copied</span>";
    setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = prevHTML; }, 1400);
  }
  return ok;
}

export function renderResults(resultsEl, parsed){
  resultsEl.innerHTML = "";
  ["version_1", "version_2", "version_3"].forEach(key => {
    const meta = VERSION_META[key];
    const v = parsed[key];
    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--card-accent", "var(--" + meta.cls + ")");

    const head = document.createElement("div");
    head.className = "card-head";
    const tag = document.createElement("span");
    tag.className = "card-tag";
    tag.textContent = meta.tag;
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.type = "button";
    copyBtn.innerHTML = copyIcon() + "<span>Copy</span>";
    copyBtn.addEventListener("click", () => copyToClipboard(v.prompt, copyBtn));
    head.appendChild(tag);
    head.appendChild(copyBtn);

    const body = document.createElement("div");
    body.className = "card-body";
    body.textContent = v.prompt;

    card.appendChild(head);
    card.appendChild(body);
    resultsEl.appendChild(card);
  });
}

export function skeletonHTML(){
  const card = '<div class="skel-card"><div class="skel-line" style="width:40%"></div>' +
    '<div class="skel-line" style="width:95%"></div><div class="skel-line" style="width:88%"></div>' +
    '<div class="skel-line" style="width:70%"></div></div>';
  return '<div class="skeleton-grid">' + card + card + card + "</div>";
}

/* ---------------- CONSOLE (12 customizations) ---------------- */

function optionEls(items, current){
  return items.map(it => {
    const val = typeof it === "string" ? it : it.id;
    const label = typeof it === "string" ? it : it.label;
    const sel = val === current ? " selected" : "";
    return '<option value="' + val + '"' + sel + ">" + label + "</option>";
  }).join("");
}

export function renderConsole(bodyEl, settings, handlers){
  bodyEl.innerHTML = `
    <div>
      <div class="console-group-title">OUTPUT</div>

      <div class="console-field">
        <label>Length</label>
        <div class="segmented" data-role="length">
          ${LENGTHS.map(l => `<button type="button" data-value="${l.id}" class="${l.id===settings.length?'active':''}">${l.label}</button>`).join("")}
        </div>
      </div>

      <div class="console-field">
        <label for="cType">Content type</label>
        <select id="cType">${optionEls(CONTENT_TYPES, settings.contentType)}</select>
      </div>

      <div class="console-field">
        <label for="cLang">Output language</label>
        <select id="cLang">${optionEls(LANGUAGES, settings.language)}</select>
      </div>
      <div class="console-field" id="cLangCustomField" style="display:${settings.language==='Custom…'?'':'none'};">
        <label for="cLangCustom">Custom language</label>
        <input type="text" id="cLangCustom" placeholder="e.g. Amharic" value="${settings.customLanguage||''}" />
      </div>

      <div class="console-field">
        <label for="cTone">Tone</label>
        <select id="cTone">${optionEls(TONES, settings.tone)}</select>
      </div>

      <div class="console-field">
        <label class="switch-row" for="cMarkup">Markdown formatting <span class="value">${settings.markup==='markdown'?'On':'Off'}</span></label>
        <label class="switch">
          <input type="checkbox" id="cMarkup" ${settings.markup==='markdown'?'checked':''}/>
          <span class="switch-track"></span>
        </label>
      </div>
    </div>

    <div>
      <div class="console-group-title">ENGINE TUNING</div>

      <div class="console-field">
        <label for="cCreativity">Creativity <span class="value" id="cCreativityVal">${settings.creativity.toFixed(1)}</span></label>
        <input type="range" id="cCreativity" min="0.2" max="1.2" step="0.1" value="${settings.creativity}" />
        <div class="range-labels"><span>Conservative</span><span>Experimental</span></div>
      </div>

      <div class="console-field">
        <label>Few-shot depth (Version 3)</label>
        <div class="segmented" data-role="fewshot">
          <button type="button" data-value="1" class="${settings.fewshotDepth===1?'active':''}">1 example</button>
          <button type="button" data-value="2" class="${settings.fewshotDepth===2?'active':''}">2 examples</button>
        </div>
      </div>

      <div class="console-field">
        <label>Persona intensity (Version 2)</label>
        <div class="segmented" data-role="persona">
          <button type="button" data-value="light" class="${settings.personaIntensity==='light'?'active':''}">Light</button>
          <button type="button" data-value="deep" class="${settings.personaIntensity==='deep'?'active':''}">Deep</button>
        </div>
      </div>

      <div class="console-field">
        <label for="cNegative">Negative constraints</label>
        <input type="text" id="cNegative" placeholder="e.g. jargon, passive voice" value="${settings.negativeConstraints||''}" />
      </div>
    </div>

    <div>
      <div class="console-group-title">INTERFACE</div>

      <div class="console-field">
        <label for="cThemeSelect">Theme</label>
        <select id="cThemeSelect">${THEMES.map(t=>`<option value="${t.id}" ${t.id===settings.theme?'selected':''}>${t.label}</option>`).join("")}</select>
      </div>

      <div class="console-field">
        <label>Density</label>
        <div class="segmented" data-role="density">
          <button type="button" data-value="comfortable" class="${settings.density==='comfortable'?'active':''}">Comfortable</button>
          <button type="button" data-value="compact" class="${settings.density==='compact'?'active':''}">Compact</button>
        </div>
      </div>

      <div class="console-field">
        <label class="switch-row" for="cAutoCopy">Auto-copy on generate <span class="value">${settings.autoCopy?'On':'Off'}</span></label>
        <label class="switch">
          <input type="checkbox" id="cAutoCopy" ${settings.autoCopy?'checked':''}/>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="console-field" id="cAutoCopyTargetField" style="display:${settings.autoCopy?'':'none'};">
        <label for="cAutoCopyTarget">Auto-copy which version</label>
        <select id="cAutoCopyTarget">
          <option value="version_1" ${settings.autoCopyVersion==='version_1'?'selected':''}>Direct & Concise</option>
          <option value="version_2" ${settings.autoCopyVersion==='version_2'?'selected':''}>Role-Based & Detailed</option>
          <option value="version_3" ${settings.autoCopyVersion==='version_3'?'selected':''}>Creative & Advanced</option>
        </select>
      </div>
    </div>

    <button class="reset-link" id="cReset" type="button">Reset all customizations to defaults</button>
  `;

  // ---- wire events ----
  function wireSegmented(role, settingKey, coerce){
    const group = bodyEl.querySelector('[data-role="' + role + '"]');
    if (!group) return;
    group.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        group.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        handlers.onChange(settingKey, coerce ? coerce(b.dataset.value) : b.dataset.value);
      });
    });
  }
  wireSegmented("length", "length");
  wireSegmented("fewshot", "fewshotDepth", v => parseInt(v, 10));
  wireSegmented("persona", "personaIntensity");
  wireSegmented("density", "density");

  bodyEl.querySelector("#cType").addEventListener("change", e => handlers.onChange("contentType", e.target.value));

  bodyEl.querySelector("#cLang").addEventListener("change", e => {
    handlers.onChange("language", e.target.value);
    bodyEl.querySelector("#cLangCustomField").style.display = e.target.value === "Custom…" ? "" : "none";
  });
  const customLangField = bodyEl.querySelector("#cLangCustom");
  if (customLangField) customLangField.addEventListener("input", e => handlers.onChange("customLanguage", e.target.value));

  bodyEl.querySelector("#cTone").addEventListener("change", e => handlers.onChange("tone", e.target.value));

  bodyEl.querySelector("#cMarkup").addEventListener("change", e => handlers.onChange("markup", e.target.checked ? "markdown" : "plain"));

  bodyEl.querySelector("#cCreativity").addEventListener("input", e => {
    bodyEl.querySelector("#cCreativityVal").textContent = parseFloat(e.target.value).toFixed(1);
    handlers.onChange("creativity", parseFloat(e.target.value));
  });

  bodyEl.querySelector("#cNegative").addEventListener("input", e => handlers.onChange("negativeConstraints", e.target.value));

  bodyEl.querySelector("#cThemeSelect").addEventListener("change", e => handlers.onChange("theme", e.target.value));

  bodyEl.querySelector("#cAutoCopy").addEventListener("change", e => {
    handlers.onChange("autoCopy", e.target.checked);
    bodyEl.querySelector("#cAutoCopyTargetField").style.display = e.target.checked ? "" : "none";
  });
  bodyEl.querySelector("#cAutoCopyTarget").addEventListener("change", e => handlers.onChange("autoCopyVersion", e.target.value));

  bodyEl.querySelector("#cReset").addEventListener("click", () => handlers.onReset());
}