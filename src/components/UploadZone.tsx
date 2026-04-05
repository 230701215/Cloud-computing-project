import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CheckCircle2, CloudUpload, FileText, FileUp, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { requestSasUpload } from '@/lib/api'
import { putWithProgress } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack, ProgressValue } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

type UploadStatus = 'queued' | 'uploading' | 'success' | 'error'

type UploadItem = {
  id: string
  file: File
  name: string
  size: number
  progress: number
  status: UploadStatus
  error?: string
}

type Props = {
  onUploaded: () => void
  autoFocus?: boolean
}

const MAX_LIST = 40

function formatBytes(n: number) {
  if (n === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / k ** i).toFixed(1))} ${sizes[i]}`
}

export function UploadZone({ onUploaded, autoFocus }: Props) {
  const [items, setItems] = useState<UploadItem[]>([])

  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return

      const newItems: UploadItem[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'queued',
      }))

      setItems((prev) => [...newItems, ...prev].slice(0, MAX_LIST))

      const runOne = async (item: UploadItem) => {
        patchItem(item.id, { status: 'uploading', progress: 0 })
        try {
          const { uploadUrl } = await requestSasUpload(item.file.name, item.file.type || undefined)
          await putWithProgress(
            uploadUrl,
            item.file,
            item.file.type || undefined,
            (pct) => patchItem(item.id, { progress: pct }),
          )
          patchItem(item.id, { status: 'success', progress: 100 })
          toast.success('Upload complete', { description: item.name })
          return true
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error'
          console.error(e)
          patchItem(item.id, { status: 'error', progress: 0, error: msg })
          toast.error('Upload failed', { description: `${item.name}: ${msg}` })
          return false
        }
      }

      const results = await Promise.all(newItems.map((item) => runOne(item)))
      if (results.some(Boolean)) {
        onUploaded()
      }
    },
    [onUploaded, patchItem],
  )

  const { getRootProps, getInputProps, isDragActive, isFocused } = useDropzone({
    onDrop,
    multiple: true,
  })

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/80 bg-card/50 shadow-sm backdrop-blur-sm',
        autoFocus && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
      )}
    >
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileUp className="size-4" />
          </span>
          Upload files
        </CardTitle>
        <CardDescription>
          Drag and drop multiple files or browse. Each file gets a SAS URL, then uploads directly to Azure Blob Storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          {...getRootProps()}
          className={cn(
            'group relative cursor-pointer rounded-2xl border-2 border-dashed border-border/90 bg-gradient-to-b from-muted/40 via-muted/20 to-transparent p-8 text-center transition-all duration-200 sm:p-10',
            'hover:border-primary/45 hover:from-primary/[0.06] hover:via-primary/[0.03]',
            isDragActive && 'scale-[1.01] border-primary bg-primary/[0.07] shadow-lg shadow-primary/10',
            isFocused && !isDragActive && 'border-ring/60 ring-2 ring-ring/20',
          )}
        >
          <input {...getInputProps()} />
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-3 rounded-xl opacity-0 transition-opacity duration-200',
              'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent',
              (isDragActive || isFocused) && 'opacity-100',
            )}
          />
          <div className="relative flex flex-col items-center gap-4">
            <div
              className={cn(
                'flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-background/80 text-primary shadow-sm',
                'ring-4 ring-primary/5 transition-transform duration-200 group-hover:scale-105',
                isDragActive && 'scale-110 border-primary/40 ring-primary/15',
              )}
            >
              <CloudUpload className={cn('size-8', isDragActive && 'animate-pulse')} strokeWidth={1.5} />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-medium text-foreground">
                {isDragActive ? 'Drop files to upload' : 'Drop files here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">
                Multiple files supported · Progress shown per file · Secure SAS upload
              </p>
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transfers</p>
            <ScrollArea className="max-h-64 rounded-xl border border-border/60 bg-muted/10 pr-3">
              <ul className="space-y-3 p-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-border/50 bg-card/80 p-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                        {item.status === 'uploading' || item.status === 'queued' ? (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        ) : item.status === 'success' ? (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        ) : item.status === 'error' ? (
                          <XCircle className="size-4 text-destructive" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span className="truncate text-sm font-medium" title={item.name}>
                            {item.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatBytes(item.size)}
                          </span>
                        </div>
                        {(item.status === 'uploading' || item.status === 'queued') && (
                          <Progress value={item.status === 'queued' ? 0 : item.progress} className="gap-1.5">
                            <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>{item.status === 'queued' ? 'Preparing…' : 'Uploading…'}</span>
                              <ProgressValue />
                            </div>
                            <ProgressTrack className="h-1.5">
                              <ProgressIndicator />
                            </ProgressTrack>
                          </Progress>
                        )}
                        {item.status === 'success' && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Uploaded successfully</p>
                        )}
                        {item.status === 'error' && item.error && (
                          <p className="text-xs text-destructive">{item.error}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
