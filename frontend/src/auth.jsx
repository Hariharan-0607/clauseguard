import { createContext, useContext, useEffect, useState } from 'react'
import { me, setToken } from './api/client.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('cg_token')) {
      me().then(setUser).catch(() => setToken('')).finally(() => setReady(true))
    } else setReady(true)
  }, [])

  function signIn({ token, user }) { setToken(token); setUser(user) }
  function signOut() { setToken(''); setUser(null) }

  return <AuthCtx.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
