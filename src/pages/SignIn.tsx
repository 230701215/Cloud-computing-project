import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SignIn() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            Sign in required
          </CardTitle>
          <CardDescription>
            This app expects Azure App Service Authentication (Easy Auth). In production, unauthenticated visitors are
            redirected to your identity provider automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            For local development, start the API with <code className="rounded bg-muted px-1 py-0.5">MOCK_EASY_AUTH=1</code>{' '}
            so <code className="rounded bg-muted px-1 py-0.5">/.auth/me</code> and <code className="rounded bg-muted px-1 py-0.5">/api/me</code>{' '}
            return a mock user.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
