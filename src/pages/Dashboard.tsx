import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { toast } from 'sonner'
import type { FileRow } from '@/lib/api'
import { fetchFiles } from '@/lib/api'
import { FileTable } from '@/components/FileTable'
import { Header } from '@/components/Header'
import { ShareModal } from '@/components/ShareModal'
import { Sidebar, type NavKey } from '@/components/Sidebar'
import { UploadZone } from '@/components/UploadZone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

type Props = {
  user: { email: string; name?: string | null; photoURL?: string | null }
  userEmail: string
  onLogout: () => void
}

export function Dashboard({ user, userEmail, onLogout }: Props) {
  const [nav, setNav] = useState<NavKey>('files')
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [shareBlob, setShareBlob] = useState<string | null>(null)
  const [shareLabel, setShareLabel] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchFiles()
      setFiles(list)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load files')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openShare = (blobName: string, displayName: string) => {
    setShareBlob(blobName)
    setShareLabel(displayName)
    setShareOpen(true)
  }

  return (
    <div className="flex min-h-svh w-full bg-background">
      <aside className="hidden shrink-0 border-r border-border lg:flex">
        <Sidebar active={nav} onNavigate={setNav} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={user}
          onLogout={onLogout}
          leading={
            <div className="lg:hidden">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="Open menu">
                      <Menu className="size-5" />
                    </Button>
                  }
                />
                <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
                  <Sidebar
                    active={nav}
                    onNavigate={(k) => {
                      setNav(k)
                      setMobileNavOpen(false)
                    }}
                    className="border-0"
                  />
                </SheetContent>
              </Sheet>
            </div>
          }
        />

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          {nav === 'upload' ? <UploadZone onUploaded={refresh} autoFocus /> : null}

          {nav === 'files' ? (
            <FileTable
              files={files}
              userEmail={userEmail}
              loading={loading}
              onRefresh={refresh}
              onShare={openShare}
            />
          ) : null}

          {nav === 'shared' ? (
            <Card>
              <CardHeader>
                <CardTitle>Shared with me</CardTitle>
                <CardDescription>
                  Password-protected and app-routed shares open at the link the sender copied. Direct SAS links open the
                  file immediately in the browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                There is no central inbox for SAS links. Ask collaborators to send you the FileShare URL, then open it
                here or in a new tab.
              </CardContent>
            </Card>
          ) : null}

          {nav === 'files' ? <UploadZone onUploaded={refresh} /> : null}
        </main>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        blobName={shareBlob}
        displayName={shareLabel}
      />
    </div>
  )
}
