import { FolderOpen, Share2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export type NavKey = 'files' | 'upload' | 'shared'

type Props = {
  active: NavKey
  onNavigate: (key: NavKey) => void
  className?: string
}

const items: { key: NavKey; label: string; icon: typeof FolderOpen }[] = [
  { key: 'files', label: 'My Files', icon: FolderOpen },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'shared', label: 'Shared with me', icon: Share2 },
]

export function Sidebar({ active, onNavigate, className }: Props) {
  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-border bg-sidebar text-sidebar-foreground lg:w-56 xl:w-64',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-sm">
          FS
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight">FileShare</p>
          <p className="truncate text-xs text-muted-foreground">Secure sharing</p>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <Button
              key={item.key}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn('justify-start gap-2', isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')}
              onClick={() => onNavigate(item.key)}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
