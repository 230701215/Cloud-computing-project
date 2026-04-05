export type ClientPrincipal = {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
  claims?: { typ: string; val: string }[]
}

export type AuthMeResponse = {
  clientPrincipal: ClientPrincipal | null
}

function claimFromPrincipal(principal: ClientPrincipal | null, ...types: string[]) {
  const claims = principal?.claims ?? []
  for (const t of types) {
    const hit = claims.find((c) => c.typ === t)
    if (hit?.val) return hit.val
  }
  return undefined
}

export function displayName(principal: ClientPrincipal | null) {
  if (!principal) return 'Guest'
  return (
    claimFromPrincipal(principal, 'name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name') ??
    principal.userDetails
  )
}

export function avatarUrl(principal: ClientPrincipal | null) {
  return claimFromPrincipal(principal, 'picture')
}

export function userEmail(principal: ClientPrincipal | null) {
  if (!principal) return ''
  return (
    claimFromPrincipal(
      principal,
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'preferred_username',
      'emails',
    ) ?? principal.userDetails
  )
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch('/.auth/me', { credentials: 'include' })
  if (!res.ok) {
    return { clientPrincipal: null }
  }
  return (await res.json()) as AuthMeResponse
}

export type AuthSessionResult =
  | { ok: true; principal: ClientPrincipal | null }
  | { ok: false; error: string }

/** Loads Easy Auth session from `/.auth/me`. Network / HTTP failures return `ok: false`. */
export async function loadAuthSession(): Promise<AuthSessionResult> {
  try {
    const res = await fetch('/.auth/me', { credentials: 'include' })
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not reach authentication endpoint (${res.status}).`,
      }
    }
    const data = (await res.json()) as AuthMeResponse
    return { ok: true, principal: data.clientPrincipal ?? null }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error while checking your session.',
    }
  }
}

export function logoutHref() {
  return '/.auth/logout'
}
