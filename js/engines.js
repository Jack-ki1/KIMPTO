// ============================================================
// KIMPTO — engines.js
// The three ways Kimpto can reach a model:
//   - Puter.js  : keyless, 400+ hosted models, browser popup auth once
//   - Gemini    : BYOK, officially supports direct browser calls
//   - Groq      : BYOK, OpenAI-compatible schema, may hit CORS from a browser
// Each returns the raw text the model produced; extractJSON() below
// turns that into the {version_1, version_2, version_3} object.
// ============================================================

let puterLoadPromise = null;
function ensurePuter(){
  if (window.puter) return Promise.resolve();
  if (puterLoadPromise) return puterLoadPromise;
  puterLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Puter.js — check your connection."));
    document.head.appendChild(s);
  });
  return puterLoadPromise;
}

export async function callPuter(systemPrompt, userMessage, settings){
  await ensurePuter();
  let model = settings.puterModel;
  if (model === "__custom__") model = settings.puterCustomModel;
  const fullPrompt = systemPrompt + "\n\n---\n\n" + userMessage;
  const opts = {};
  if (model) opts.model = model;
  if (typeof settings.creativity === "number") opts.temperature = settings.creativity;
  const response = await window.puter.ai.chat(fullPrompt, opts);
  if (typeof response === "string") return response;
  if (response && response.message && response.message.content) return response.message.content;
  if (response && response.text) return response.text;
  return JSON.stringify(response);
}

export async function callGemini(systemPrompt, userMessage, settings){
  const key = settings.geminiKey;
  if (!key) throw new Error("Add your Gemini API key in the sidebar first.");
  const model = settings.keyModel || "gemini-2.5-flash-lite";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { responseMimeType: "application/json", temperature: settings.creativity }
    })
  });
  if (!res.ok){
    const body = await res.text().catch(() => "");
    throw new Error("Gemini error " + res.status + ": " + body.slice(0, 200));
  }
  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
    && data.candidates[0].content.parts[0].text;
  if (!text) throw new Error("Gemini returned no content — it may have blocked the response.");
  return text;
}

export async function callGroq(systemPrompt, userMessage, settings){
  const key = settings.groqKey;
  if (!key) throw new Error("Add your Groq API key in the sidebar first.");
  const model = settings.keyModel || "llama-3.3-70b-versatile";
  let res;
  try{
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        response_format: { type: "json_object" },
        temperature: settings.creativity
      })
    });
  }catch(networkErr){
    throw new Error("Request to Groq failed before it left the browser — this is almost always a CORS block. Try 'My Key → Gemini' or the Free lane instead.");
  }
  if (!res.ok){
    const body = await res.text().catch(() => "");
    throw new Error("Groq error " + res.status + ": " + body.slice(0, 200));
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("Groq returned no content.");
  return text;
}

export function extractJSON(raw){
  if (!raw) throw new Error("Empty response from model.");
  let text = String(raw).trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Model response didn't contain JSON.");
  const parsed = JSON.parse(text.slice(start, end + 1));
  ["version_1", "version_2", "version_3"].forEach(k => {
    if (!parsed[k] || !parsed[k].prompt) throw new Error("Response was missing " + k + ".");
  });
  return parsed;
}
