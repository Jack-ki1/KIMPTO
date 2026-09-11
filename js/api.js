// api.js
//
// This is a purely static site — there is no backend at all, so both
// generation paths now happen directly in the browser:
//
//   Free tier  -> Puter.js (https://js.puter.com/v2/), which is designed
//                 to run client-side; its keyless access is tied to an
//                 anonymous browser session and was never callable from a
//                 server anyway.
//
//   Bring-your-own-key -> a direct fetch() straight to the provider's own
//                 public API from this page, using the key the person
//                 typed into Settings. Two of the three providers
//                 explicitly support this:
//
//                 - Claude (Anthropic): supported via the documented
//                   "anthropic-dangerous-direct-browser-access" header,
//                   which exists specifically for client-side apps like
//                   this one.
//                 - Gemini (Google AI Studio): the Generative Language API
//                   sends permissive CORS headers and is designed for
//                   direct browser use — this is the same thing Google's
//                   own AI Studio "get code" snippets show.
//                 - GPT (OpenAI): api.openai.com does NOT send CORS
//                   headers for arbitrary browser origins, so a direct
//                   request from here will typically be blocked by the
//                   browser before a response ever comes back. It's still
//                   attempted (some private/self-hosted proxies do allow
//                   it), but expect it to fail with a CORS error on a
//                   plain static deploy — see the README for the
//                   server-proxied alternative if you need GPT BYOK to
//                   work reliably.

import { buildSystemPrompt, buildUserMessage, buildRefinePrompt, extractJSON, deriveConvention } from "./catalog.js";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ---------------- free tier: Puter.js ---------------- */

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

/* ---------------- bring-your-own-key: direct provider calls ---------------- */

async function callClaudeDirect(apiKey, model, promptText, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: promptText }] }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `Claude API error (${res.status})`);
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function callGeminiDirect(apiKey, model, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `Gemini API error (${res.status})`);
  const candidate = data && data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  return parts ? parts.map((p) => p.text || "").join("") : "";
}

async function callOpenAIDirect(apiKey, model, promptText, maxTokens) {
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_completion_tokens: maxTokens, messages: [{ role: "user", content: promptText }] }),
    });
  } catch (e) {
    // A network-level failure here is almost always the browser blocking
    // the request under CORS before it ever reached OpenAI.
    throw new Error("OpenAI blocked this request (likely CORS — its API doesn't allow direct browser calls from a static site). See the README for a server-proxied alternative.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `OpenAI API error (${res.status})`);
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
}

async function callProviderDirect(provider, apiKey, model, promptText, maxTokens) {
  if (!apiKey) throw new Error("An API key is required for bring-your-own-key generation.");
  if (!model) throw new Error("Missing model.");
  if (provider === "claude") return callClaudeDirect(apiKey, model, promptText, maxTokens);
  if (provider === "gemini") return callGeminiDirect(apiKey, model, promptText);
  if (provider === "gpt") return callOpenAIDirect(apiKey, model, promptText, maxTokens);
  throw new Error(`Unknown provider: ${provider}`);
}

/* ---------------- single dispatcher used by both modes ---------------- */

async function callModel(modelChoice, promptText, maxTokens = 1000) {
  if (modelChoice.mode === "free") return callPuterModel(promptText, modelChoice.free);
  return callProviderDirect(modelChoice.byokProvider, modelChoice.byokKey, modelChoice.byokModel, promptText, maxTokens);
}

/* ---------------- public API used by main.js ---------------- */

export async function generate({ modelChoice, task, details, techniqueIds, settings, onProgress }) {
  const convention = deriveConvention(modelChoice);
  const userMsg = buildUserMessage({ task, ...details });
  const chunks = chunk(techniqueIds, 3);
  let merged = {};

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(chunks.length > 1 ? `Generating ${i + 1}/${chunks.length}…` : null);
    const sys = buildSystemPrompt(chunks[i], settings, convention);
    const raw = await callModel(modelChoice, sys + "\n\n---\n\n" + userMsg, 1200);
    merged = { ...merged, ...extractJSON(raw) };
  }
  return merged;
}

export async function refine({ modelChoice, entry, instruction, settings }) {
  const convention = deriveConvention(modelChoice);
  const sys = buildRefinePrompt(entry.prompt, instruction, settings, convention);
  const raw = await callModel(modelChoice, sys, 1000);
  return extractJSON(raw);
}

export async function testRun({ modelChoice, promptText, sampleInput }) {
  const combined = promptText + "\n\n---\n\nUser input:\n" + (sampleInput || "Respond to the instructions above using a realistic example.");
  const output = await callModel(modelChoice, combined, 1000);
  return { output };
}
