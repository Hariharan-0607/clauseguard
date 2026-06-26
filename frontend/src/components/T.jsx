import { useT, useUI } from '../ui.jsx'

// Renders English `children` translated into the active UI language (AI-backed, cached).
// Falls back to English instantly, then updates when the translation arrives.
export default function T({ children }) {
  const tr = useT()
  useUI().version // subscribe to re-render when new translations land
  return <>{typeof children === 'string' ? tr(children) : children}</>
}
