import { createContext, useContext, useEffect, useState } from 'react'
import { translateBatch } from './api/client.js'
import { aiLanguage } from './i18n.js'

const UICtx = createContext(null)

// localStorage-backed translation cache: { [lang]: { [english]: translated } }
function loadCache() {
  try { return JSON.parse(localStorage.getItem('cg_tcache') || '{}') } catch { return {} }
}
function saveCache(c) {
  try { localStorage.setItem('cg_tcache', JSON.stringify(c)) } catch { /* quota */ }
}

export function UIProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('cg_uilang') || 'en')
  const [dark, setDark] = useState(() => localStorage.getItem('cg_dark') === '1')
  const [cache, setCache] = useState(loadCache)
  const [version, setVersion] = useState(0)   // bump to re-render when new translations arrive

  useEffect(() => { localStorage.setItem('cg_uilang', lang) }, [lang])
  useEffect(() => {
    localStorage.setItem('cg_dark', dark ? '1' : '0')
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // pending strings to translate, debounced into one batch call
  const pending = new Set()
  let timer = null

  function queue(text) {
    if (lang === 'en' || !text) return
    const have = cache[lang]?.[text]
    if (have !== undefined) return
    pending.add(text)
    clearTimeout(timer)
    timer = setTimeout(flush, 120)
  }

  async function flush() {
    const texts = [...pending]; pending.clear()
    if (!texts.length) return
    try {
      const translations = await translateBatch(texts, aiLanguage(lang))
      setCache((prev) => {
        const next = { ...prev, [lang]: { ...(prev[lang] || {}) } }
        texts.forEach((t, i) => { next[lang][t] = translations[i] ?? t })
        saveCache(next)
        return next
      })
      setVersion((v) => v + 1)
    } catch { /* keep English on failure */ }
  }

  // Translate one string: returns cached translation, else English (and queues it).
  function tr(text) {
    if (lang === 'en') return text
    const hit = cache[lang]?.[text]
    if (hit !== undefined) return hit
    queue(text)
    return text
  }

  return (
    <UICtx.Provider value={{ lang, setLang, dark, setDark, tr, version }}>
      {children}
    </UICtx.Provider>
  )
}

export const useUI = () => useContext(UICtx)

// Hook: translate any English string to the active language (AI-backed, cached).
export function useT() {
  const { tr } = useUI()
  return tr
}
