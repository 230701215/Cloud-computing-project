import { useEffect, useMemo, useState } from 'react'
import { addHours, format } from 'date-fns'
import { CalendarIcon, Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { createShare } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type ExpiryPreset = '1h' | '24h' | '7d' | 'custom'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  blobName: string | null
  displayName: string
}

const PRESET_LABELS: Record<ExpiryPreset, string> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
  custom: 'Custom date & time',
}

function computeExpiry(preset: ExpiryPreset, customDate: Date, customTime: string): Date | null {
  const now = Date.now()
  if (preset === '1h') return new Date(now + 60 * 60 * 1000)
  if (preset === '24h') return new Date(now + 24 * 60 * 60 * 1000)
  if (preset === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000)
  const [hh, mm] = customTime.split(':').map((x) => Number(x))
  const d = new Date(customDate)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0)
  return d
}

export function ShareModal({ open, onOpenChange, blobName, displayName }: Props) {
  const defaults = useMemo(() => {
    const d = addHours(new Date(), 24)
    return { customDate: d, customTime: format(d, 'HH:mm') }
  }, [])

  const [preset, setPreset] = useState<ExpiryPreset>('24h')
  const [customDate, setCustomDate] = useState<Date>(defaults.customDate)
  const [customTime, setCustomTime] = useState(defaults.customTime)
  const [password, setPassword] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setLink('')
      setPassword('')
      setPreset('24h')
      setCustomDate(defaults.customDate)
      setCustomTime(defaults.customTime)
    }
  }, [open, defaults.customDate, defaults.customTime])

  async function generate() {
    if (!blobName) return
    const expires = computeExpiry(preset, customDate, customTime)
    if (!expires || expires.getTime() <= Date.now()) {
      toast.error('Expiry must be in the future')
      return
    }
    setLoading(true)
    try {
      const res = await createShare(blobName, expires, password || undefined)
      setLink(res.shareUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Share failed')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Copied to clipboard', { description: 'Share link is ready to paste.' })
    } catch {
      toast.error('Could not copy', { description: 'Try selecting the link and copying manually.' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-2 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Link2 className="size-4" />
            </span>
            Share file
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Create a time-bound link for <span className="font-medium text-foreground">{displayName}</span>. Anyone with
            the link can access the file until it expires. Add a password to require unlock on the share page first.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-6 py-5">
          <div className="grid gap-2">
            <Label htmlFor="share-expiry">Link expires</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as ExpiryPreset)}>
              <SelectTrigger id="share-expiry" className="w-full max-w-none" size="default">
                <SelectValue>{PRESET_LABELS[preset]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">{PRESET_LABELS['1h']}</SelectItem>
                <SelectItem value="24h">{PRESET_LABELS['24h']}</SelectItem>
                <SelectItem value="7d">{PRESET_LABELS['7d']}</SelectItem>
                <SelectItem value="custom">{PRESET_LABELS.custom}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === 'custom' ? (
            <div className="grid gap-2">
              <Label>Custom expiry</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button type="button" variant="outline" className={cn('justify-start text-left font-normal sm:flex-1')}>
                        <CalendarIcon className="mr-2 size-4" />
                        {format(customDate, 'PPP')}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDate} onSelect={(d) => d && setCustomDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="sm:w-36"
                  aria-label="Expiry time"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="share-password">Password (optional)</Label>
            <Input
              id="share-password"
              type="password"
              autoComplete="new-password"
              placeholder="Recipients enter this on the share page"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {link ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="share-url">Share URL</Label>
                <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 shrink-0" onClick={copy}>
                  <Copy className="size-3.5" />
                  Copy link
                </Button>
              </div>
              <Textarea
                id="share-url"
                readOnly
                value={link}
                rows={4}
                className="resize-none font-mono text-xs leading-relaxed break-all"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={generate} disabled={!blobName || loading}>
            {loading ? 'Generating…' : link ? 'Regenerate link' : 'Generate shareable link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
