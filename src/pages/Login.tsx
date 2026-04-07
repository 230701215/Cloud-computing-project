import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { auth, googleProvider } from '@/firebase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Login() {
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      toast.success('Signed in')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      toast.error('Sign-in failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Welcome to FileShare
          </CardTitle>
          <CardDescription>Sign in with Google to upload, share, and manage your files.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full gap-2" size="lg" onClick={signIn} disabled={loading}>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
              <path
                fill="currentColor"
                d="M12 10.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 0 0 0-3.6Zm9.8 1.8c0-.7-.1-1.3-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.5h3.4c2-1.8 3-4.4 3-7.4Z"
              />
              <path
                fill="currentColor"
                d="M12 22c2.7 0 5-0.9 6.7-2.5l-3.4-2.5c-0.9.6-2.1 1-3.3 1c-2.5 0-4.6-1.7-5.4-4H3.1v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="currentColor"
                d="M6.6 13.5a6 6 0 0 1 0-3V7.9H3.1a10 10 0 0 0 0 8.9l3.5-2.7Z"
              />
              <path
                fill="currentColor"
                d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 12 2A10 10 0 0 0 3.1 7.9l3.5 2.6C7.4 7.7 9.5 6 12 6Z"
              />
            </svg>
            {loading ? 'Signing in…' : 'Sign in with Google'}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Google sign-in only. Your files are isolated by your account email.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

