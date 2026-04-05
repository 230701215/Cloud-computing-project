import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ClientPrincipal } from '@/lib/auth'
import { loadAuthSession, userEmail } from '@/lib/auth'
import { Dashboard } from '@/pages/Dashboard'
import { SharedPage } from '@/pages/SharedPage'
import { SignIn } from '@/pages/SignIn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type AuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; principal: ClientPrincipal | null }

function AuthLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Checking your session</p>
        <p className="mt-1 text-xs text-muted-foreground">Contacting /.auth/me…</p>
      </div>
    </div>
  )
}

function AuthErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-destructive/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5 shrink-0" />
            Something went wrong
          </CardTitle>
          <CardDescription>We could not verify your session with the authentication service.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-muted-foreground">{message}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function MainShell() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  const runAuth = useCallback(async () => {
    setAuth({ status: 'loading' })
    const result = await loadAuthSession()
    if (!result.ok) {
      setAuth({ status: 'error', message: result.error })
      toast.error('Session check failed', { description: result.error })
      return
    }
    setAuth({ status: 'ready', principal: result.principal })
  }, [])

  useEffect(() => {
    void runAuth()
  }, [runAuth])

  if (auth.status === 'loading') {
    return <AuthLoading />
  }

  if (auth.status === 'error') {
    return <AuthErrorScreen message={auth.message} onRetry={runAuth} />
  }

  const { principal } = auth
  if (!principal) {
    return <SignIn />
  }

  const email = userEmail(principal)
  return <Dashboard principal={principal} userEmail={email} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/shared/:token" element={<SharedPage />} />
        <Route path="*" element={<MainShell />} />
      </Routes>
    </BrowserRouter>
  )
}
