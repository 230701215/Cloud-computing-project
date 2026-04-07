import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { toast } from 'sonner'
import { firebaseAuth, googleProvider } from '@/lib/firebase'
import { setIdToken } from '@/lib/authToken'

type AuthContextValue = {
  user: User | null
  idToken: string | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const unsub = onAuthStateChanged(
      firebaseAuth,
      async (u) => {
        try {
          setError(null)
          setUser(u)
          if (!u) {
            setToken(null)
            setIdToken(null)
            return
          }
          const t = await u.getIdToken()
          setToken(t)
          setIdToken(t)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Authentication error'
          setError(msg)
          toast.error('Auth error', { description: msg })
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setError(err.message)
        setLoading(false)
        toast.error('Auth error', { description: err.message })
      },
    )
    return () => unsub()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      idToken,
      loading,
      error,
      signInWithGoogle: async () => {
        await signInWithPopup(firebaseAuth, googleProvider)
        toast.success('Signed in')
      },
      logout: async () => {
        await signOut(firebaseAuth)
        setIdToken(null)
        toast.success('Signed out')
      },
    }),
    [user, idToken, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

