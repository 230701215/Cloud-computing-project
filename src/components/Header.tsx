import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import type { ClientPrincipal } from '@/lib/auth'
import { avatarUrl, displayName, logoutHref } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  principal: ClientPrincipal | null
  /** Shown before the title area (e.g. mobile nav sheet trigger). */
  leading?: ReactNode
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

export function Header({ principal, leading }: Props) {
  const name = displayName(principal)
  const pic = avatarUrl(principal)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/40 px-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-3">
        {leading}
        <span className="truncate text-sm font-semibold tracking-tight lg:hidden">FileShare</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-10 gap-2 px-2 sm:px-3">
                <Avatar className="size-8">
                  <AvatarImage src={pic} alt="" referrerPolicy="no-referrer" />
                  <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[160px] truncate text-sm font-medium sm:inline">{name}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="truncate font-medium">{name}</span>
                {principal?.userDetails ? (
                  <span className="truncate text-xs text-muted-foreground">{principal.userDetails}</span>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                window.location.href = logoutHref()
              }}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          href={logoutHref()}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'hidden sm:inline-flex')}
        >
          Log out
        </a>
      </div>
    </header>
  )
}
