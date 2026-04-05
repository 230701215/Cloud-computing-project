import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { ShareAccessError, redeemShare } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SharedPage() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [needPassword, setNeedPassword] = useState(false)

  async function unlock() {
    if (!token) return
    setLoading(true)
    try {
      const res = await redeemShare(token, password || undefined)
      setNeedPassword(false)
      window.open(res.url, '_blank', 'noopener,noreferrer')
      toast.success('Opening download…')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      if (e instanceof ShareAccessError && e.needPassword) {
        setNeedPassword(true)
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Shared file access
          </CardTitle>
          <CardDescription>
            If this link is password protected, enter the password you received, then download the file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw">Password (if required)</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {needPassword ? <p className="text-xs text-destructive">Check the password and try again.</p> : null}
          </div>
          <Button className="w-full gap-2" onClick={unlock} disabled={!token || loading}>
            <Download className="size-4" />
            {loading ? 'Working…' : 'Get download link'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
