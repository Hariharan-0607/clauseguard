// Languages for AI output + voice (input speech-to-text and output text-to-speech).
// `speech` is the BCP-47 locale used by the browser Web Speech API.
// `ai` is the human-readable name we send to the LLM so it replies in that language.
export const LANGUAGES = [
  { code: 'en', label: 'English', ai: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिन्दी · Hindi', ai: 'Hindi', speech: 'hi-IN' },
  { code: 'ta', label: 'தமிழ் · Tamil', ai: 'Tamil', speech: 'ta-IN' },
  { code: 'te', label: 'తెలుగు · Telugu', ai: 'Telugu', speech: 'te-IN' },
  { code: 'bn', label: 'বাংলা · Bengali', ai: 'Bengali', speech: 'bn-IN' },
  { code: 'mr', label: 'मराठी · Marathi', ai: 'Marathi', speech: 'mr-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ · Kannada', ai: 'Kannada', speech: 'kn-IN' },
  { code: 'gu', label: 'ગુજરાતી · Gujarati', ai: 'Gujarati', speech: 'gu-IN' },
  { code: 'ml', label: 'മലയാളം · Malayalam', ai: 'Malayalam', speech: 'ml-IN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ · Punjabi', ai: 'Punjabi', speech: 'pa-IN' },
  { code: 'ur', label: 'اردو · Urdu', ai: 'Urdu', speech: 'ur-IN' }
]

const BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]))
const BY_AI_NAME = Object.fromEntries(LANGUAGES.map((l) => [l.ai.toLowerCase(), l.code]))

export function langInfo(code) {
  return BY_CODE[code] || LANGUAGES[0]
}

// Map a stored AI language name (e.g. "Hindi") or a code back to a language code.
export function resolveCode(value) {
  if (!value) return 'en'
  if (BY_CODE[value]) return value
  return BY_AI_NAME[String(value).toLowerCase()] || 'en'
}

// Name we pass to the AI (so it explains/answers in the chosen language).
export function aiLanguage(code) {
  return langInfo(code).ai
}

// BCP-47 locale for the Web Speech API.
export function speechLocale(code) {
  return langInfo(code).speech
}
