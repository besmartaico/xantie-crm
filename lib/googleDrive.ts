// @ts-nocheck
import { Readable } from 'stream'
import { google } from 'googleapis'

function getDriveAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export function getDrive() {
  return google.drive({ version: 'v3', auth: getDriveAuth() })
}

const FOLDER_ID = () => process.env.GOOGLE_DRIVE_FOLDER_ID

// Upload a PDF buffer to the configured Drive folder.
// For Shared Drives, we upload directly with parents set so the file is
// owned by the Shared Drive (not by the service account, which has no quota).
export async function uploadPdfToDrive(buffer, fileName, opts) {
  opts = opts || {}
  const drive = getDrive()
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [FOLDER_ID()],
      ...(opts.appProperties ? { appProperties: opts.appProperties } : {}),
    },
    media: {
      mimeType: opts.mimeType || 'application/pdf',
      body: Readable.from(buffer),
    },
    fields: 'id,name,webViewLink,appProperties',
    supportsAllDrives: true,
  })
  return created.data
}

// List PDFs in the configured Drive folder
export async function listPdfsInFolder() {
  const drive = getDrive()
  const res = await drive.files.list({
    q: `'${FOLDER_ID()}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: 'files(id,name,webViewLink,modifiedTime,createdTime,size,appProperties)',
    orderBy: 'modifiedTime desc',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  })
  return res.data.files || []
}

// Download a Drive file as a Buffer (for pdf-lib to process)
export async function downloadPdfFromDrive(fileId) {
  const drive = getDrive()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data)
}

// Get a file's metadata (used to read appProperties = field definitions)
export async function getDriveFileMeta(fileId) {
  const drive = getDrive()
  const res = await drive.files.get({
    fileId,
    fields: 'id,name,webViewLink,modifiedTime,createdTime,size,appProperties',
    supportsAllDrives: true,
  })
  return res.data
}

// Update file metadata (used to save field definitions to appProperties)
export async function updateDriveFileMeta(fileId, appProperties) {
  const drive = getDrive()
  const cleaned = {}
  for (const [k, v] of Object.entries(appProperties)) {
    cleaned[k] = v === null || v === undefined ? null : String(v)
  }
  const res = await drive.files.update({
    fileId,
    requestBody: { appProperties: cleaned },
    fields: 'id,name,appProperties',
    supportsAllDrives: true,
  })
  return res.data
}

// Delete a Drive file (used when removing a template)
export async function deleteDriveFile(fileId) {
  const drive = getDrive()
  // Try permanent delete first (works if service account is Content Manager / Manager on the Shared Drive).
  // If that fails with a permission error, fall back to moving the file to trash (works with Contributor).
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return { method: 'deleted' }
  } catch(e) {
    const code = e && (e.code || (e.response && e.response.status))
    if (code === 403 || code === 401) {
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        supportsAllDrives: true,
        fields: 'id,trashed',
      })
      return { method: 'trashed' }
    }
    throw e
  }
}
