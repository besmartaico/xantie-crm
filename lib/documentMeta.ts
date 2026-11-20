// @ts-nocheck
// Document ACL + folder metadata, stored in two Google Sheets tabs so the Drive
// files (and their near-full appProperties field budget) stay untouched.
//   Document_Meta:    fileId | ownerEmail | folderId | shareAll | sharedWith | updatedAt
//   Document_Folders: id | name | ownerEmail | createdAt
import { google } from 'googleapis'

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}
const SID = () => process.env.GOOGLE_SHEETS_ID

// The one user who can see every document. Override with MASTER_ADMIN_EMAIL.
export const MASTER_ADMIN = (process.env.MASTER_ADMIN_EMAIL || 'jeff@xantie.com').toLowerCase()
export function norm(e) { return (e || '').toString().trim().toLowerCase() }

const META_TAB = 'Document_Meta'
const META_COLS = ['fileId', 'ownerEmail', 'folderId', 'shareAll', 'sharedWith', 'updatedAt']
const FOLDERS_TAB = 'Document_Folders'
const FOLDERS_COLS = ['id', 'name', 'ownerEmail', 'createdAt']

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function rowToObj(r, cols) { const o = {}; cols.forEach((c, i) => { o[c] = r[i] || '' }); return o }

async function ensureTab(sheets, title, cols) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  if (!meta.data.sheets.find(s => s.properties.title === title)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SID(), requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    })
    const lastCol = String.fromCharCode(64 + cols.length)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'${title}'!A1:${lastCol}1`,
      valueInputOption: 'RAW', requestBody: { values: [cols] },
    })
  }
}

// ---------- META ----------
export async function readAllMeta() {
  const sheets = getSheets()
  await ensureTab(sheets, META_TAB, META_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${META_TAB}'!A2:F200000` })
  const map = {}
  ;(r.data.values || []).forEach(row => { const o = rowToObj(row, META_COLS); if (o.fileId) map[o.fileId] = o })
  return map
}

export async function setMeta(fileId, patch) {
  const sheets = getSheets()
  await ensureTab(sheets, META_TAB, META_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${META_TAB}'!A2:F200000` })
  const rows = r.data.values || []
  const idx = rows.findIndex(row => row[0] === fileId)
  const cur = idx === -1 ? { fileId } : rowToObj(rows[idx], META_COLS)
  const merged = { ...cur, ...patch, fileId, updatedAt: new Date().toISOString() }
  const out = [META_COLS.map(c => merged[c] ?? '')]
  const rowNum = idx === -1 ? rows.length + 2 : idx + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SID(), range: `'${META_TAB}'!A${rowNum}:F${rowNum}`,
    valueInputOption: 'RAW', requestBody: { values: out },
  })
  return merged
}

export async function deleteMeta(fileId) {
  const sheets = getSheets()
  await ensureTab(sheets, META_TAB, META_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${META_TAB}'!A2:F200000` })
  const rows = r.data.values || []
  const idx = rows.findIndex(row => row[0] === fileId)
  if (idx === -1) return
  const rowNum = idx + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SID(), range: `'${META_TAB}'!A${rowNum}:F${rowNum}`,
    valueInputOption: 'RAW', requestBody: { values: [['', '', '', '', '', '']] },
  })
}

// Can `viewerEmail` see a document with this meta row?
export function canView(metaRow, viewerEmail) {
  const v = norm(viewerEmail)
  if (v && v === MASTER_ADMIN) return true
  const owner = norm(metaRow && metaRow.ownerEmail)
  if (!owner) return true                       // legacy / unowned → visible to all admins
  if (owner === v) return true
  if (metaRow.shareAll === '1' || metaRow.shareAll === 'true') return true
  const list = (metaRow.sharedWith || '').split(',').map(norm).filter(Boolean)
  return list.includes(v)
}

// ---------- FOLDERS ----------
export async function listFolders(ownerEmail, all = false) {
  const sheets = getSheets()
  await ensureTab(sheets, FOLDERS_TAB, FOLDERS_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!A2:D200000` })
  const rows = (r.data.values || []).map(row => rowToObj(row, FOLDERS_COLS)).filter(f => f.id)
  if (all) return rows
  const o = norm(ownerEmail)
  return rows.filter(f => norm(f.ownerEmail) === o)
}

export async function createFolder(name, ownerEmail) {
  const sheets = getSheets()
  await ensureTab(sheets, FOLDERS_TAB, FOLDERS_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!A2:D200000` })
  const rows = r.data.values || []
  const id = 'fld_' + uid()
  const createdAt = new Date().toISOString()
  const rowNum = rows.length + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!A${rowNum}:D${rowNum}`,
    valueInputOption: 'RAW', requestBody: { values: [[id, name, norm(ownerEmail), createdAt]] },
  })
  return { id, name, ownerEmail: norm(ownerEmail), createdAt }
}

export async function renameFolder(id, name, requesterEmail) {
  if (!name) throw new Error('Folder name required')
  const sheets = getSheets()
  await ensureTab(sheets, FOLDERS_TAB, FOLDERS_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!A2:D200000` })
  const rows = r.data.values || []
  const idx = rows.findIndex(row => row[0] === id)
  if (idx === -1) throw new Error('Folder not found')
  if (norm(rows[idx][2]) !== norm(requesterEmail) && norm(requesterEmail) !== MASTER_ADMIN) throw new Error('Not allowed')
  await sheets.spreadsheets.values.update({
    spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!B${idx + 2}`,
    valueInputOption: 'RAW', requestBody: { values: [[name]] },
  })
  return { id, name }
}

export async function deleteFolder(id, requesterEmail) {
  const sheets = getSheets()
  await ensureTab(sheets, FOLDERS_TAB, FOLDERS_COLS)
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!A2:D200000` })
  const rows = r.data.values || []
  const idx = rows.findIndex(row => row[0] === id)
  if (idx === -1) return
  if (norm(rows[idx][2]) !== norm(requesterEmail) && norm(requesterEmail) !== MASTER_ADMIN) throw new Error('Not allowed')
  await sheets.spreadsheets.values.update({
    spreadsheetId: SID(), range: `'${FOLDERS_TAB}'!A${idx + 2}:D${idx + 2}`,
    valueInputOption: 'RAW', requestBody: { values: [['', '', '', '']] },
  })
  // Unfile any documents that lived in this folder (they move to "Unfiled").
  const metaMap = await readAllMeta()
  for (const [fileId, m] of Object.entries(metaMap)) {
    if (m.folderId === id) await setMeta(fileId, { folderId: '' })
  }
}
