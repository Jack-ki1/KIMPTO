// voice.js — thin wrappers around the browser's native Web Speech API.
// No server involvement and no API key: both recognition and synthesis are
// entirely client-side browser features, feature-detected so the rest of
// the app can degrade gracefully where they're unavailable.

const SpeechRecognitionAPI = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const voiceInputSupported = !!SpeechRecognitionAPI;
export const voiceOutputSupported = typeof window !== "undefined" && !!window.speechSynthesis;

let recognition = null;

/**
 * Start listening and stream interim transcripts to onUpdate(text).
 * Calls onEnd() when recognition stops (silence, error, or manual stop).
 */
export function startListening(onUpdate, onEnd, onError) {
  if (!voiceInputSupported) {
    if (onError) onError("Voice input isn't available in this browser");
    return;
  }
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (e) => {
    let transcript = "";
    for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
    onUpdate(transcript);
  };
  recognition.onerror = () => {
    if (onError) onError("Voice input error");
    if (onEnd) onEnd();
  };
  recognition.onend = () => {
    if (onEnd) onEnd();
  };
  try {
    recognition.start();
  } catch (e) {
    if (onError) onError("Couldn't start voice input");
  }
}

export function stopListening() {
  if (recognition) recognition.stop();
}

let currentUtterance = null;

export function speak(text, onEnd) {
  if (!voiceOutputSupported) return false;
  window.speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.onend = () => onEnd && onEnd();
  currentUtterance.onerror = () => onEnd && onEnd();
  window.speechSynthesis.speak(currentUtterance);
  return true;
}

export function stopSpeaking() {
  if (voiceOutputSupported) window.speechSynthesis.cancel();
}
