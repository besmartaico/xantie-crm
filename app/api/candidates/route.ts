// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version:'v4', auth })
}
const SID = () => process.env.GOOGLE_SHEETS_ID
function uid() { return Date.now().toString(36)+Math.random().toString(36).substr(2,5) }

// Spreadsheet column letter for a 1-based index (1->A, 26->Z, 27->AA).
function colLetter(n) {
  let s = ''
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// IMPORTANT: new fields are APPENDED after the original 20 columns so existing
// rows (written with the A..T layout) are not shifted. Reads are position-based.
const COLS = [
  'id','name','email','location','skillset','linkedin','resume','source',
  'firstContactDate','firstContactMethod','dateInterviewed','dateAvailable','dateHired',
  'wouldHire','salaryRequirement','notes','experienceYears','certifications','status','createdAt',
  // ── appended (recruiting automation) ──
  'roleType','stage','phone','score','scoreReason','addedBy','lastContactedAt',
]
const LAST = colLetter(COLS.length)
const SHEET = 'Candidates'

async function ensureSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  if (!meta.data.sheets.find(s=>s.properties.title===SHEET)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests:[{ addSheet:{ properties:{ title:SHEET } } }] } })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'${SHEET}'!A1:${LAST}1`,
      valueInputOption: 'RAW', requestBody: { values: [COLS] }
    })
  }
}

async function getRows(sheets) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${SHEET}'!A2:${LAST}200000` })
    return r.data.values || []
  } catch(e) { return [] }
}

function rowToObj(r) {
  const o = {}
  COLS.forEach((c, i) => { o[c] = r[i] || '' })
  return o
}

function objToRow(o) {
  return COLS.map(c => o[c] ?? '')
}

function rowRange(rowNum) { return `'${SHEET}'!A${rowNum}:${LAST}${rowNum}` }

export async function GET() {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const rows = await getRows(sheets)
    return NextResponse.json(rows.map(rowToObj))
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const body = await req.json()

    if (body.action === 'bulk_add') {
      const incoming = body.candidates || []
      if (!Array.isArray(incoming) || incoming.length === 0) {
        return NextResponse.json({ success: false, error: 'No candidates to import' }, { status: 400 })
      }
      const rows = await getRows(sheets)
      const startRow = rows.length + 2
      const now = new Date().toISOString()
      const newRows = incoming.map(c => objToRow({
        ...c, id: uid(),
        status: c.status||'active',
        stage: c.stage || 'Sourced',
        createdAt: now,
      }))
      const endRow = startRow + newRows.length - 1
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'${SHEET}'!A${startRow}:${LAST}${endRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: newRows }
      })
      return NextResponse.json({ success: true, count: newRows.length })
    }

    if (body.action === 'add') {
      const rows = await getRows(sheets)
      const nextRow = rows.length + 2
      const id = uid()
      const newCandidate = {
        ...body, id,
        status: body.status||'active',
        stage: body.stage || 'Sourced',
        createdAt: new Date().toISOString(),
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: rowRange(nextRow),
        valueInputOption: 'RAW',
        requestBody: { values: [objToRow(newCandidate)] }
      })
      return NextResponse.json({ success: true, id })
    }

    if (body.action === 'update') {
      const rows = await getRows(sheets)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const rowNum = idx + 2
      const cur = rowToObj(rows[idx])
      const merged = { ...cur, ...body, id: cur.id, createdAt: cur.createdAt }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: rowRange(rowNum),
        valueInputOption: 'RAW',
        requestBody: { values: [objToRow(merged)] }
      })
      return NextResponse.json({ success: true })
    }

    // Record that a candidate was contacted; optionally advance the pipeline stage.
    if (body.action === 'log_contact') {
      const rows = await getRows(sheets)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const rowNum = idx + 2
      const cur = rowToObj(rows[idx])
      const merged = {
        ...cur,
        lastContactedAt: new Date().toISOString(),
        stage: (cur.stage === '' || cur.stage === 'Sourced') ? 'Contacted' : cur.stage,
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: rowRange(rowNum),
        valueInputOption: 'RAW',
        requestBody: { values: [objToRow(merged)] }
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete') {
      const rows = await getRows(sheets)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const sheetId = meta.data.sheets.find(s=>s.properties.title===SHEET).properties.sheetId
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension:'ROWS', startIndex: idx+1, endIndex: idx+2 } } }] }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
