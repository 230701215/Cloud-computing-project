import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  Download,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileMusic,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  FolderOpen,
  Search,
  SearchX,
  Share2,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FileRow } from '@/lib/api'
import { deleteFile, getDownloadUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type SortKey = 'name' | 'lastModified'
type SortDir = 'asc' | 'desc'

function formatBytes(n: number) {
  if (n === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / k ** i).toFixed(2))} ${sizes[i]}`
}

function displayFileName(blobName: string, email: string) {
  const prefix = `${email}/`
  return blobName.startsWith(prefix) ? blobName.slice(prefix.length) : blobName
}

function fileExtension(displayName: string) {
  const i = displayName.lastIndexOf('.')
  if (i <= 0 || i === displayName.length - 1) return ''
  return displayName.slice(i + 1).toLowerCase()
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'avif'])
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'wmv'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'])
const CODE_EXT = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'py',
  'rs',
  'go',
  'java',
  'cs',
  'cpp',
  'c',
  'h',
  'rb',
  'php',
  'swift',
  'kt',
  'sql',
  'sh',
  'yaml',
  'yml',
  'xml',
])
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'])
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md'])
const SHEET_EXT = new Set(['xls', 'xlsx', 'csv', 'ods'])

function fileTypeIcon(displayName: string): LucideIcon {
  const ext = fileExtension(displayName)
  if (IMAGE_EXT.has(ext)) return FileImage
  if (VIDEO_EXT.has(ext)) return FileVideoCamera
  if (AUDIO_EXT.has(ext)) return FileMusic
  if (CODE_EXT.has(ext)) return FileCode2
  if (ARCHIVE_EXT.has(ext)) return FileArchive
  if (DOC_EXT.has(ext)) return FileText
  if (SHEET_EXT.has(ext)) return FileSpreadsheet
  return File
}

function FileTypeIcon({ displayName, className }: { displayName: string; className?: string }) {
  const Icon = fileTypeIcon(displayName)
  return <Icon className={cn('size-4 shrink-0 text-muted-foreground', className)} aria-hidden />
}

type Props = {
  files: FileRow[]
  userEmail: string
  loading?: boolean
  onRefresh: () => void
  onShare: (blobName: string, displayName: string) => void
}

export function FileTable({ files, userEmail, loading, onRefresh, onShare }: Props) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastModified')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = files.map((f) => ({
      ...f,
      display: displayFileName(f.name, userEmail),
    }))
    if (q) {
      list = list.filter((f) => f.display.toLowerCase().includes(q))
    }
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'lastModified') {
        return (new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()) * dir
      }
      return a.display.localeCompare(b.display, undefined, { sensitivity: 'base' }) * dir
    })
    return list
  }, [files, query, sortDir, sortKey, userEmail])

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDir(key === 'name' ? 'asc' : 'desc')
      return key
    })
  }, [])

  const handleDownload = useCallback(async (blobName: string) => {
    try {
      const { url } = await getDownloadUrl(blobName)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    }
  }, [])

  const handleDelete = useCallback(
    async (blobName: string) => {
      if (!confirm('Delete this file permanently?')) return
      try {
        await deleteFile(blobName)
        toast.success('File deleted')
        onRefresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Delete failed')
      }
    },
    [onRefresh],
  )

  const handleRowActivate = useCallback(
    (blobName: string) => {
      void handleDownload(blobName)
    },
    [handleDownload],
  )

  const isEmptyLibrary = !loading && files.length === 0
  const isFilteredEmpty = !loading && files.length > 0 && rows.length === 0

  const NameSortGlyph = sortKey === 'name' ? (sortDir === 'asc' ? ArrowUpAZ : ArrowDownAZ) : ArrowDownAZ
  const DateSortGlyph =
    sortKey === 'lastModified' ? (sortDir === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow) : ArrowDownWideNarrow

  return (
    <Card>
      <CardHeader className="gap-4 space-y-0 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Your files</CardTitle>
          <CardDescription>Search by name, sort by filename or upload date, click a row to download.</CardDescription>
        </div>
        <div className="relative w-full sm:max-w-xs sm:shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files by filename"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {isEmptyLibrary ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center sm:px-10">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground">
              <FolderOpen className="size-8 stroke-[1.25]" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-base font-medium text-foreground">No files yet</p>
              <p className="text-sm text-muted-foreground">
                Upload documents from the Upload section. They will appear here with secure Azure-backed storage.
              </p>
            </div>
          </div>
        ) : isFilteredEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center sm:px-10">
            <div className="flex size-14 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
              <SearchX className="size-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-base font-medium text-foreground">No matching files</p>
              <p className="text-sm text-muted-foreground">
                Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different search or clear the filter.
              </p>
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[200px]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 gap-1.5 font-semibold"
                      onClick={() => toggleSort('name')}
                    >
                      Filename
                      <NameSortGlyph
                        className={cn('size-4 opacity-40', sortKey === 'name' && 'opacity-100')}
                        aria-hidden
                      />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden w-[100px] min-w-[100px] text-right sm:table-cell">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</span>
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 gap-1.5 font-semibold"
                      onClick={() => toggleSort('lastModified')}
                    >
                      Uploaded at
                      <DateSortGlyph
                        className={cn('size-4 opacity-40', sortKey === 'lastModified' && 'opacity-100')}
                        aria-hidden
                      />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[140px] min-w-[140px] text-right">
                    <span className="pr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Actions
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 animate-pulse rounded-full bg-primary" />
                        Loading files…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((f) => (
                    <TableRow
                      key={f.name}
                      tabIndex={0}
                      className={cn(
                        'cursor-pointer transition-colors',
                        'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      )}
                      onClick={() => handleRowActivate(f.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRowActivate(f.name)
                        }
                      }}
                      title="Click to download"
                    >
                      <TableCell className="max-w-0">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
                            <FileTypeIcon displayName={f.display} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium" title={f.display}>
                              {f.display}
                            </p>
                            <p className="text-xs text-muted-foreground sm:hidden">{formatBytes(f.size)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                        {formatBytes(f.size)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <time dateTime={f.lastModified}>{format(new Date(f.lastModified), 'PPp')}</time>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            title="Download"
                            aria-label={`Download ${f.display}`}
                            onClick={() => void handleDownload(f.name)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            title="Share"
                            aria-label={`Share ${f.display}`}
                            onClick={() => onShare(f.name, f.display)}
                          >
                            <Share2 className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive"
                            title="Delete"
                            aria-label={`Delete ${f.display}`}
                            onClick={() => void handleDelete(f.name)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
