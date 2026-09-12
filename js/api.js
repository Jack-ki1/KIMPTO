// api.js — GitHub Pages / static build.
//
// Free-tier generation calls Puter.js directly from the browser, same as
// the Flask build (Puter's keyless access only ever worked client-side).
//
// Bring-your-own-key generation ALSO calls the provider directly from the
// browser here — there is no backend in this build to proxy through.
// That's only possible for providers whose API actually allows a
// cross-origin browser request:
//
//   - Claude (Anthropic): supported, via the documented
//     "anthropic-dangerous-direct-browser-access" header.
//   - Gemini (Google): supported out of the box on the standard
//     generateContent endpoint.
//   - GPT (OpenAI): NOT supported — OpenAI's API does not return the
//     Access-Control-Allow-Origin header a browser needs, for any origin.
//     There is no client-side workaround for this; it requires a server.
//     See README.md's "Why GPT bring-your-own-key isn't here" section.
//     GPT is still fully available in the Free tier (routed through
//     Puter.js, which calls OpenAI server-side on your behalf).
//
// Because there's no server here, a bring-your-own-key call means the key
// leaves the browser exactly once, straight to that provider's own API —
// it never touches any server Kimpto controls, static or otherwise.

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

async function callClaudeDirect(apiKey, model, promptText, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: promptText }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || `Claude request failed (${res.status}).`);
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function callGeminiDirect(apiKey, model, promptText, maxTokens) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || `Gemini request failed (${res.status}).`);
  const candidate = data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  return parts ? parts.map((p) => p.text || "").join("") : "";
}

async function callByok(provider, apiKey, model, promptText, maxTokens) {
  if (!apiKey) throw new Error("An API key is required.");
  if (provider === "claude") return callClaudeDirect(apiKey, model, promptText, maxTokens);
  if (provider === "gemini") return callGeminiDirect(apiKey, model, promptText, maxTokens);
  if (provider === "gpt") {
    throw new Error(
      "GPT bring-your-own-key isn't available in this static build — OpenAI's API doesn't allow direct browser calls, and this build has no backend to proxy through. Use a GPT model from the Free tier instead, or run the Flask version of Kimpto for GPT BYOK."
    );
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function callForModelChoice(modelChoice, promptText, maxTokens) {
  if (modelChoice.mode === "free") return callPuterModel(promptText, modelChoice.free);
  return callByok(modelChoice.byokProvider, modelChoice.byokKey, modelChoice.byokModel, promptText, maxTokens);
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

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(chunks.length > 1 ? `Generating ${i + 1}/${chunks.length}…` : null);
    const sys = buildSystemPrompt(chunks[i], settings, convention);
    const raw = await callForModelChoice(modelChoice, sys + "\n\n---\n\n" + userMsg, 1200);
    merged = { ...merged, ...extractJSON(raw) };
  }
  return merged;
}

export async function refine({ modelChoice, entry, instruction, settings }) {
  const convention = deriveConvention(modelChoice);
  const sys = buildRefinePrompt(entry.prompt, instruction, settings, convention);
  const raw = await callForModelChoice(modelChoice, sys, 1000);
  return extractJSON(raw);
}

export async function testRun({ modelChoice, promptText, sampleInput }) {
  const combined = promptText + "\n\n---\n\nUser input:\n" + (sampleInput || "Respond to the instructions above using a realistic example.");
  const output = await callForModelChoice(modelChoice, combined, 1000);
  return { output };
}
