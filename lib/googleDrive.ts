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
  // Strategy:
  // 1) Verify file exists from service account's perspective via files.get
  // 2) Try permanent delete (requires Manager role on Shared Drive)
  // 3) If that fails with permission/not-found, fall back to trash (requires Contributor or higher)
  // Note: Google Drive sometimes returns 404 instead of 403 for permission errors as a security measure,
  // so we treat 401/403/404 as "try the trash fallback" rather than re-throwing immediately.

  // Step 1: confirm visibility
  let meta = null
  try {
    const got = await drive.files.get({
      fileId,
      fields: 'id,name,trashed,driveId',
      supportsAllDrives: true,
    })
    meta = got.data
  } catch(e) {
    const code = e && (e.code || (e.response && e.response.status))
    throw new Error('Cannot find file ' + fileId + ' (HTTP ' + code + '). The service account may not have access. ' + (e.message || ''))
  }

  if (meta.trashed) {
    return { method: 'already-trashed', name: meta.name }
  }

  // Step 2: try permanent delete
  let permanentError = null
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return { method: 'deleted', name: meta.name }
  } catch(e) {
    permanentError = e
  }

  // Step 3: trash fallback
  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
      fields: 'id,trashed',
    })
    return { method: 'trashed', name: meta.name }
  } catch(trashError) {
    const pCode = permanentError && (permanentError.code || (permanentError.response && permanentError.response.status))
    const tCode = trashError && (trashError.code || (trashError.response && trashError.response.status))
    throw new Error(
      'Both delete (HTTP ' + pCode + ': ' + (permanentError.message || '') + ') and trash (HTTP ' + tCode + ': ' + (trashError.message || '') + ') failed. ' +
      'The service account likely needs at least "Contributor" role on the Shared Drive.'
    )
  }
}
