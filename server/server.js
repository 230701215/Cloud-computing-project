/**
 * Express API for Azure Blob Storage + Easy Auth patterns.
 * Env: AZURE_STORAGE_CONNECTION_STRING (required), AZURE_STORAGE_CONTAINER (default: files),
 *      FRONTEND_ORIGIN (CORS), PORT, MOCK_EASY_AUTH, MOCK_USER_EMAIL, MOCK_USER_NAME
 */
import 'dotenv/config'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '../dist')

const PORT = Number(process.env.PORT ?? 3001)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER ?? 'files'

const UPLOAD_SAS_MINUTES = 15
const SHARE_READ_HOURS = 24

// --- in-memory password-protected shares (POST /api/share) ---
/** @type {Map<string, { blobName: string, expiresAt: Date, passwordHash?: string }>} */
const shareStore = new Map()

function hashPassword(pw) {
  return createHash('sha256').update(pw, 'utf8').digest('hex')
}

function consumeShareIfExpired() {
  const now = Date.now()
  for (const [k, v] of shareStore) {
    if (v.expiresAt.getTime() < now) shareStore.delete(k)
  }
}

// --- connection string → clients ---
/** @type {{ blobService: BlobServiceClient, credential: StorageSharedKeyCredential } | null} */
let storageCache = null

function getStorage() {
  if (storageCache) return storageCache
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set')
  const blobService = BlobServiceClient.fromConnectionString(conn)
  const parts = conn.split(';').reduce((acc, part) => {
    const [k, ...rest] = part.split('=')
    if (k && rest.length) acc[k.toLowerCase()] = rest.join('=')
    return acc
  }, {})
  const account = parts.accountname
  const key = parts.accountkey
  if (!account || !key) throw new Error('Could not parse account name/key from AZURE_STORAGE_CONNECTION_STRING')
  const credential = new StorageSharedKeyCredential(account, key)
  storageCache = { blobService, credential }
  return storageCache
}

function userPrefix(email) {
  return `${email}/`
}

function assertOwnsBlob(email, blobName) {
  const p = userPrefix(email)
  if (!blobName.startsWith(p)) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }
}

async function ensureContainer() {
  const { blobService } = getStorage()
  const container = blobService.getContainerClient(CONTAINER)
  await container.createIfNotExists()
}

async function listUserBlobs(email) {
  const { blobService } = getStorage()
  const container = blobService.getContainerClient(CONTAINER)
  const prefix = userPrefix(email)
  const files = []
  for await (const item of container.listBlobsFlat({ prefix })) {
    if (!item.name || item.name.endsWith('/')) continue
    files.push({
      name: item.name,
      size: item.properties.contentLength ?? 0,
      lastModified: item.properties.lastModified?.toISOString() ?? new Date().toISOString(),
    })
  }
  return files
}

async function deleteBlob(blobName) {
  const { blobService } = getStorage()
  const container = blobService.getContainerClient(CONTAINER)
  await container.deleteBlob(blobName)
}

function sasWriteUrl(blobName, expiresMsFromNow) {
  const { blobService, credential } = getStorage()
  const container = blobService.getContainerClient(CONTAINER)
  const blob = container.getBlockBlobClient(blobName)
  const startsOn = new Date(Date.now() - 5 * 60 * 1000)
  const expiresOn = new Date(Date.now() + expiresMsFromNow)
  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential,
  ).toString()
  return { uploadUrl: `${blob.url}?${sas}`, expiresOn }
}

function sasReadUrl(blobName, expiresOn) {
  const { blobService, credential } = getStorage()
  const container = blobService.getContainerClient(CONTAINER)
  const blob = container.getBlockBlobClient(blobName)
  const startsOn = new Date(Date.now() - 5 * 60 * 1000)
  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential,
  ).toString()
  return `${blob.url}?${sas}`
}

// --- Easy Auth: decode X-MS-CLIENT-PRINCIPAL (base64 JSON) ---
function claim(claims, ...types) {
  if (!claims?.length) return undefined
  for (const t of types) {
    const c = claims.find((x) => x.typ === t)
    if (c?.val) return c.val
  }
  return undefined
}

function decodeMsClientPrincipal(headerValue) {
  if (!headerValue) return null
  try {
    const json = Buffer.from(headerValue, 'base64').toString('utf8')
    const payload = JSON.parse(json)
    const claims = payload.claims ?? []
    const email =
      claim(
        claims,
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        'emails',
        'preferred_username',
      ) ?? claim(claims, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn')
    const name =
      claim(claims, 'name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name') ?? email
    const userId =
      claim(claims, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier', 'sub', 'oid') ??
      email ??
      'unknown'
    const picture = claim(claims, 'picture')
    if (!email) return null
    return { userId, email, name: name ?? email, picture }
  } catch {
    return null
  }
}

function getUserFromRequest(req) {
  if (process.env.MOCK_EASY_AUTH === '1') {
    return {
      userId: 'mock-id',
      email: process.env.MOCK_USER_EMAIL ?? 'dev@local.test',
      name: process.env.MOCK_USER_NAME ?? 'Local Dev',
      picture: process.env.MOCK_USER_PICTURE,
    }
  }
  return decodeMsClientPrincipal(req.headers['x-ms-client-principal'])
}

function toClientPrincipal(user) {
  return {
    identityProvider: 'easyauth',
    userId: user.userId,
    userDetails: user.email,
    userRoles: [],
    claims: [
      { typ: 'name', val: user.name },
      { typ: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', val: user.email },
      ...(user.picture ? [{ typ: 'picture', val: user.picture }] : []),
    ],
  }
}

/** Blob path may contain `/`; client sends one path segment as base64url. */
function decodeBlobPathSegment(segment) {
  if (!segment) return null
  try {
    const s = Buffer.from(segment, 'base64url').toString('utf8')
    return s || null
  } catch {
    return null
  }
}

const app = express()
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))

function requireUser(req, res) {
  const user = getUserFromRequest(req)
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }
  return user
}

// --- Easy Auth mirror (local dev / proxy) ---
app.get('/.auth/me', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.json({ clientPrincipal: null })
  return res.json({ clientPrincipal: toClientPrincipal(user) })
})

app.get('/.auth/logout', (_req, res) => {
  res.redirect(302, `${FRONTEND_ORIGIN}/`)
})

// --- Core routes (spec) ---

/** GET /api/me — user from X-MS-CLIENT-PRINCIPAL */
app.get('/api/me', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  res.json({
    user: {
      id: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  })
})

/** POST /api/sas-upload — write SAS (15 min), blob under user email prefix */
app.post('/api/sas-upload', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  try {
    await ensureContainer()
  } catch (e) {
    console.error(e)
    return res.status(503).json({ error: 'Storage is not configured' })
  }
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : ''
  if (!fileName || fileName.includes('..') || fileName.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid fileName' })
  }
  const blobName = `${userPrefix(user.email)}${fileName}`
  try {
    const { uploadUrl, expiresOn } = sasWriteUrl(blobName, UPLOAD_SAS_MINUTES * 60 * 1000)
    return res.json({ uploadUrl, blobName, sasExpiresAt: expiresOn.toISOString() })
  } catch (e) {
    console.error(e)
    return res.status(503).json({ error: 'Could not create upload URL' })
  }
})

/** GET /api/files — list blobs with user prefix */
app.get('/api/files', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  try {
    await ensureContainer()
    const files = await listUserBlobs(user.email)
    return res.json({ files })
  } catch (e) {
    console.error(e)
    return res.status(503).json({ error: 'Could not list files', files: [] })
  }
})

/**
 * GET /api/share/:blobName — read SAS (24h). :blobName is base64url(UTF-8 blob path).
 * Returns shareUrl (full blob URL + SAS query).
 */
app.get('/api/share/:blobName', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const blobName = decodeBlobPathSegment(req.params.blobName)
  if (!blobName) return res.status(400).json({ error: 'Invalid blobName segment' })
  try {
    assertOwnsBlob(user.email, blobName)
  } catch (e) {
    const status = e.status ?? 403
    return res.status(status).json({ error: 'Forbidden' })
  }
  try {
    await ensureContainer()
    const expiresOn = new Date(Date.now() + SHARE_READ_HOURS * 60 * 60 * 1000)
    const shareUrl = sasReadUrl(blobName, expiresOn)
    return res.json({
      shareUrl,
      blobName,
      expiresAt: expiresOn.toISOString(),
    })
  } catch (e) {
    console.error(e)
    return res.status(503).json({ error: 'Could not create share URL' })
  }
})

// --- Extra routes used by the SPA ---

app.delete('/api/files', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const blobName = typeof req.query.name === 'string' ? req.query.name : ''
  if (!blobName) return res.status(400).json({ error: 'Missing name' })
  try {
    assertOwnsBlob(user.email, blobName)
    await ensureContainer()
    await deleteBlob(blobName)
    return res.json({ ok: true })
  } catch (e) {
    const status = e.status ?? 500
    console.error(e)
    return res.status(status).json({ error: 'Delete failed' })
  }
})

app.get('/api/files/download', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const blobName = typeof req.query.name === 'string' ? req.query.name : ''
  if (!blobName) return res.status(400).json({ error: 'Missing name' })
  try {
    assertOwnsBlob(user.email, blobName)
    await ensureContainer()
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000)
    const url = sasReadUrl(blobName, expiresOn)
    return res.json({ url, expiresAt: expiresOn.toISOString() })
  } catch (e) {
    const status = e.status ?? 500
    console.error(e)
    return res.status(status).json({ error: 'Download failed' })
  }
})

/** POST /api/share/:blobName — custom expiry + optional password (SPA) */
app.post('/api/share/:blobName', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const blobName = decodeBlobPathSegment(req.params.blobName)
  if (!blobName) return res.status(400).json({ error: 'Invalid blobName segment' })
  try {
    assertOwnsBlob(user.email, blobName)
  } catch {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const expiresAtRaw = req.body?.expiresAt
  const expiresAt = typeof expiresAtRaw === 'string' ? new Date(expiresAtRaw) : null
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return res.status(400).json({ error: 'Invalid expiresAt' })
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : undefined
  consumeShareIfExpired()
  try {
    await ensureContainer()
    const passwordHash = password && password.length > 0 ? hashPassword(password) : undefined
    if (!passwordHash) {
      const url = sasReadUrl(blobName, expiresAt)
      return res.json({
        shareUrl: url,
        expiresAt: expiresAt.toISOString(),
        token: null,
      })
    }
    const token = randomUUID()
    shareStore.set(token, { blobName, expiresAt, passwordHash })
    const shareUrl = `${FRONTEND_ORIGIN}/shared/${token}`
    return res.json({
      shareUrl,
      expiresAt: expiresAt.toISOString(),
      token,
    })
  } catch (e) {
    console.error(e)
    return res.status(503).json({ error: 'Could not create share link' })
  }
})

app.post('/api/share-access/:token', async (req, res) => {
  consumeShareIfExpired()
  const token = req.params.token
  const rec = shareStore.get(token)
  if (!rec || rec.expiresAt.getTime() < Date.now()) {
    return res.status(404).json({ error: 'Link expired or invalid' })
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (rec.passwordHash) {
    if (!password) {
      return res.status(401).json({ error: 'Password required', needPassword: true })
    }
    if (hashPassword(password) !== rec.passwordHash) {
      return res.status(401).json({ error: 'Invalid password', needPassword: true })
    }
  }
  try {
    await ensureContainer()
    const url = sasReadUrl(rec.blobName, rec.expiresAt)
    return res.json({ url, expiresAt: rec.expiresAt.toISOString() })
  } catch (e) {
    console.error(e)
    return res.status(503).json({ error: 'Could not prepare download' })
  }
})

setInterval(() => consumeShareIfExpired(), 60 * 1000)

// --- Production: serve Vite React build + client-side routing ---
app.use(express.static(DIST_DIR))

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next()
  }
  if (req.path.startsWith('/api') || req.path.startsWith('/.auth')) {
    return next()
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) next(err)
  })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
  console.log(`CORS origin: ${FRONTEND_ORIGIN}`)
  console.log(`Static (if present): ${DIST_DIR}`)
  if (process.env.MOCK_EASY_AUTH === '1') {
    console.log('MOCK_EASY_AUTH=1 — using MOCK_USER_EMAIL / MOCK_USER_NAME')
  }
})
