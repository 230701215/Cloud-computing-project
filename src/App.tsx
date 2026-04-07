import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { Dashboard } from '@/pages/Dashboard'
import { Login } from '@/pages/Login'
import { SharedPage } from '@/pages/SharedPage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function AuthLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Checking your session</p>
        <p className="mt-1 text-xs text-muted-foreground">Contacting Firebase…</p>
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
  const { user, loading, error, logout } = useAuth()

  useEffect(() => {
    if (error) toast.error('Auth error', { description: error })
  }, [error])

  if (loading) return <AuthLoading />
  if (error) return <AuthErrorScreen message={error} onRetry={() => window.location.reload()} />
  if (!user) return <Login />

  return (
    <Dashboard
      user={{ email: user.email ?? '', name: user.displayName, photoURL: user.photoURL }}
      userEmail={user.email ?? ''}
      onLogout={logout}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/shared/:token" element={<SharedPage />} />
          <Route path="*" element={<MainShell />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
