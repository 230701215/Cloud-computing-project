export type ApiUser = {
  id: string
  email: string
  name: string
  picture?: string
}

export type FileRow = {
  name: string
  size: number
  lastModified: string
}

export async function fetchMe(): Promise<ApiUser | null> {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to load profile')
  const data = (await res.json()) as { user: ApiUser }
  return data.user
}

export async function fetchFiles(): Promise<FileRow[]> {
  const res = await fetch('/api/files', { credentials: 'include' })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Failed to list files')
  }
  const data = (await res.json()) as { files: FileRow[] }
  return data.files
}

export async function requestSasUpload(fileName: string, contentType?: string) {
  const res = await fetch('/api/sas-upload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Could not start upload')
  }
  return (await res.json()) as { uploadUrl: string; blobName: string }
}

export async function deleteFile(blobName: string) {
  const q = new URLSearchParams({ name: blobName })
  const res = await fetch(`/api/files?${q.toString()}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Delete failed')
  }
}

export async function getDownloadUrl(blobName: string) {
  const q = new URLSearchParams({ name: blobName })
  const res = await fetch(`/api/files/download?${q.toString()}`, { credentials: 'include' })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Download failed')
  }
  return (await res.json()) as { url: string; expiresAt: string }
}

/** Encode blob path for POST /api/share/:blobName (base64url, safe for paths with `/`). */
function sharePathSegment(blobName: string) {
  const bytes = new TextEncoder().encode(blobName)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createShare(blobName: string, expiresAt: Date, password?: string) {
  const segment = sharePathSegment(blobName)
  const res = await fetch(`/api/share/${segment}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expiresAt: expiresAt.toISOString(),
      ...(password && password.length > 0 ? { password } : {}),
    }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Could not create share link')
  }
  return (await res.json()) as { shareUrl: string; expiresAt: string; token: string | null }
}

export class ShareAccessError extends Error {
  needPassword?: boolean
  constructor(message: string, needPassword?: boolean) {
    super(message)
    this.name = 'ShareAccessError'
    this.needPassword = needPassword
  }
}

export async function redeemShare(token: string, password?: string) {
  const res = await fetch(`/api/share-access/${encodeURIComponent(token)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password ?? '' }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
    needPassword?: boolean
  }
  if (!res.ok) {
    throw new ShareAccessError(data.error ?? 'Could not open share link', Boolean(data.needPassword))
  }
  return data as { url: string; expiresAt: string }
}
