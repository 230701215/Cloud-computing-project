/**
 * Express API for Azure Blob Storage + Firebase Auth
 */

import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { getAdmin } from './firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

const PORT = Number(process.env.PORT ?? 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER ?? 'files';

const UPLOAD_SAS_MINUTES = 15;
const SHARE_READ_HOURS = 24;

// --- in-memory password-protected shares ---
const shareStore = new Map();

function hashPassword(pw) {
  return createHash('sha256').update(pw, 'utf8').digest('hex');
}

function consumeShareIfExpired() {
  const now = Date.now();
  for (const [k, v] of shareStore) {
    if (v.expiresAt.getTime() < now) shareStore.delete(k);
  }
}

// --- Storage Setup ---
let storageCache = null;

function getStorage() {
  if (storageCache) return storageCache;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');

  const blobService = BlobServiceClient.fromConnectionString(conn);
  const parts = conn.split(';').reduce((acc, part) => {
    const [k, ...rest] = part.split('=');
    if (k && rest.length) acc[k.toLowerCase()] = rest.join('=');
    return acc;
  }, {});

  const account = parts.accountname;
  const key = parts.accountkey;
  if (!account || !key) throw new Error('Could not parse storage account name/key');

  const credential = new StorageSharedKeyCredential(account, key);
  storageCache = { blobService, credential };
  return storageCache;
}

function userPrefix(email) {
  return `${email}/`;
}

function assertOwnsBlob(email, blobName) {
  if (!blobName.startsWith(userPrefix(email))) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

async function ensureContainer() {
  const { blobService } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  await container.createIfNotExists();
}

async function listUserBlobs(email) {
  const { blobService } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  const prefix = userPrefix(email);
  const files = [];
  for await (const item of container.listBlobsFlat({ prefix })) {
    if (!item.name || item.name.endsWith('/')) continue;
    files.push({
      name: item.name,
      size: item.properties.contentLength ?? 0,
      lastModified: item.properties.lastModified?.toISOString() ?? new Date().toISOString(),
    });
  }
  return files;
}

async function deleteBlob(blobName) {
  const { blobService } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  await container.deleteBlob(blobName);
}

function sasWriteUrl(blobName, expiresMsFromNow) {
  const { blobService, credential } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  const blob = container.getBlockBlobClient(blobName);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiresMsFromNow);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();

  return { uploadUrl: `${blob.url}?${sas}`, expiresOn };
}

function sasReadUrl(blobName, expiresOn) {
  const { blobService, credential } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  const blob = container.getBlockBlobClient(blobName);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();

  return `${blob.url}?${sas}`;
}

// Firebase Token Verification Middleware
async function verifyFirebaseToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const token = match?.[1];

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }

    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) {
      return res.status(401).json({ error: 'Token missing email claim' });
    }

    req.user = decoded;
    next();
  } catch (e) {
    console.error('Token verification failed:', e);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const app = express();

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// ====================== API ROUTES ======================

app.get('/api/me', verifyFirebaseToken, (req, res) => {
  res.json({
    user: {
      id: req.user.uid,
      email: req.user.email,
      name: req.user.name ?? req.user.email,
      picture: req.user.picture,
    },
  });
});

app.post('/api/sas-upload', verifyFirebaseToken, async (req, res) => {
  const user = req.user;
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : '';

  if (!fileName || fileName.includes('..') || fileName.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid fileName' });
  }

  try {
    await ensureContainer();
    const blobName = `${userPrefix(user.email)}${fileName}`;
    const { uploadUrl, expiresOn } = sasWriteUrl(blobName, UPLOAD_SAS_MINUTES * 60 * 1000);
    res.json({ uploadUrl, blobName, sasExpiresAt: expiresOn.toISOString() });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: 'Could not create upload URL' });
  }
});

app.get('/api/files', verifyFirebaseToken, async (req, res) => {
  try {
    await ensureContainer();
    const files = await listUserBlobs(req.user.email);
    res.json({ files });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: 'Could not list files', files: [] });
  }
});

// Add your other routes here (delete, download, share, etc.) if needed

// ====================== STATIC FILES + SPA ROUTING ======================

console.log('Current directory:', __dirname);
console.log('DIST_DIR path:', DIST_DIR);
console.log('Does dist folder exist?', fs.existsSync(DIST_DIR));

// Serve React build
app.use(express.static(DIST_DIR));

// Catch-all for React SPA - MUST BE LAST
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  console.log(`Serving index.html for path: ${req.path}`);
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Build files not found. Please check deployment.');
    }
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${DIST_DIR}`);
});