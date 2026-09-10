// api.js
//
// Free-tier generation calls Puter.js (https://js.puter.com/v2/) directly
// from the browser — that's the only way to reach its keyless free access,
// since it's tied to an anonymous browser session rather than a server-
// callable REST endpoint with a fixed key. Bring-your-own-key generation
// instead posts to this app's own Flask routes, which use the official
// server-side SDK for whichever provider was chosen (see
// kimpto/services/providers.py). Both paths converge on the same
// {techId: {label, prompt, rationale}} shape so the rendering code in
// ui.js never needs to know which path was used.

import { buildSystemPrompt, buildUserMessage, buildRefinePrompt, extractJSON, deriveConvention } from "./catalog.js";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function callPuterModel(promptText, modelId) {
  if (!window.puter || !window.puter.ai || !window.puter.ai.chat) {
    throw new Error("Puter.js hasn't loaded yet — check your connection and try again.");
  }
  const result = await window.puter.ai.chat(promptText, { model: modelId });
  if (typeof result === "string") return result;
  if (result && result.message && result.message.content) {
    const c = result.message.content;
    return typeof c === "string" ? c : (c[0] && c[0].text) || "";
  }
  if (result && result.text) return result.text;
  return String(result);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

/**
 * Generate one prompt per selected technique.
 * @returns {Promise<Object>} merged {techId: {label, prompt, rationale}}
 */
export async function generate({ modelChoice, task, details, techniqueIds, settings, onProgress }) {
  const convention = deriveConvention(modelChoice);
  const userMsg = buildUserMessage({ task, ...details });
  const chunks = chunk(techniqueIds, 3);
  let merged = {};

  if (modelChoice.mode === "free") {
    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) onProgress(chunks.length > 1 ? `Generating ${i + 1}/${chunks.length}…` : null);
      const sys = buildSystemPrompt(chunks[i], settings, convention);
      const raw = await callPuterModel(sys + "\n\n---\n\n" + userMsg, modelChoice.free);
      merged = { ...merged, ...extractJSON(raw) };
    }
    return merged;
  }

  // BYOK: the backend does the chunking + provider call itself, in one request.
  const data = await postJSON("/api/generate", {
    task,
    details,
    techniques: techniqueIds,
    settings,
    provider: modelChoice.byokProvider,
    model: modelChoice.byokModel,
    apiKey: modelChoice.byokKey,
  });
  return data.results;
}

export async function refine({ modelChoice, entry, instruction, settings }) {
  const convention = deriveConvention(modelChoice);

  if (modelChoice.mode === "free") {
    const sys = buildRefinePrompt(entry.prompt, instruction, settings, convention);
    const raw = await callPuterModel(sys, modelChoice.free);
    return extractJSON(raw);
  }

  return postJSON("/api/refine", {
    prompt: entry.prompt,
    instruction,
    settings,
    provider: modelChoice.byokProvider,
    model: modelChoice.byokModel,
    apiKey: modelChoice.byokKey,
  });
}

export async function testRun({ modelChoice, promptText, sampleInput }) {
  if (modelChoice.mode === "free") {
    const combined = promptText + "\n\n---\n\nUser input:\n" + (sampleInput || "Respond to the instructions above using a realistic example.");
    return { output: await callPuterModel(combined, modelChoice.free) };
  }
  return postJSON("/api/test-run", {
    prompt: promptText,
    input: sampleInput,
    provider: modelChoice.byokProvider,
    model: modelChoice.byokModel,
    apiKey: modelChoice.byokKey,
  });
}
