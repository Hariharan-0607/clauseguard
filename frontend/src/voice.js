// Multilingual voice helpers built on the free, in-browser Web Speech API.
import { speechLocale } from './i18n.js'

export const speechSupported = () =>
  typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export const ttsSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

// --- Speech to text (voice input) ---
// Returns a "stop" function. Calls onResult(text) with the transcript,
// onError(msg) on failure, and onState(listening:boolean) on start/stop.
export function startDictation({ langCode, onResult, onError, onState }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { onError?.('Voice input is not supported in this browser. Try Chrome.'); return () => {} }
  const r = new SR()
  r.lang = speechLocale(langCode)
  r.interimResults = false
  r.maxAlternatives = 1
  r.onstart = () => onState?.(true)
  r.onend = () => onState?.(false)
  r.onerror = (e) => {
    onState?.(false)
    const map = {
      'no-speech': 'No speech detected — please try again.',
      'not-allowed': 'Microphone access was blocked. Allow it in your browser settings.',
      'language-not-supported': 'This language isn’t supported for voice input on this device.',
      'network': 'Network error during voice recognition.'
    }
    onError?.(map[e.error] || `Voice error: ${e.error}`)
  }
  r.onresult = (e) => onResult?.(e.results[0][0].transcript)
  try { r.start() } catch { /* already started */ }
  return () => { try { r.stop() } catch { /* noop */ } }
}

// --- Text to speech (read aloud) ---
// Picks the best browser voice matching the chosen language locale.
function pickVoice(locale) {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const base = locale.split('-')[0]
  return (
    voices.find((v) => v.lang?.toLowerCase() === locale.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    null
  )
}

// Returns { ok, reason } so callers can tell the user when a language voice is missing.
export function speak(text, langCode) {
  if (!ttsSupported()) return { ok: false, reason: 'unsupported' }
  if (!text) return { ok: false, reason: 'empty' }
  const locale = speechLocale(langCode)
  const v = pickVoice(locale)
  // For non-English with no matching device voice, don't silently read in English.
  if (!v && !locale.startsWith('en')) {
    return { ok: false, reason: 'no-voice' }
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = locale
  if (v) u.voice = v
  u.rate = 0.98
  window.speechSynthesis.speak(u)
  return { ok: true }
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

// Voices load async in some browsers — warm them up once.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}
