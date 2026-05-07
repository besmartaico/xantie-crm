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

const FUNNEL_COLS = ['id','companyName','contactName','contactEmail','billingContact','projectDetails','notes','anticipatedRate','stage','duration','probability','resource','expectedRevenue','creationDate','lastInteractedOn','nextStep']
const PROJECTS_COLS = ['id','billingCustomer','customerName','customerType','salesContact','salesEmail','invoicingEmail','startDate','endDate','rate','resource','notes','status','createdAt']
const BENCH_COLS = ['id','name','status','rate','availabilityStart','notes','createdAt']

const SHEETS_CONFIG = {
  funnel:   { sheet:'Sales_Funnel',     cols: FUNNEL_COLS,   range: 'A2:P5000', headerRange: 'A1:P1' },
  projects: { sheet:'Current_Projects', cols: PROJECTS_COLS, range: 'A2:N5000', headerRange: 'A1:N1' },
  bench:    { sheet:'Bench',            cols: BENCH_COLS,    range: 'A2:G5000', headerRange: 'A1:G1' },
}

async function ensureSheet(sheets, key) {
  const cfg = SHEETS_CONFIG[key]
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  if (!meta.data.sheets.find(s=>s.properties.title===cfg.sheet)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests:[{ addSheet:{ properties:{ title:cfg.sheet } } }] } })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'${cfg.sheet}'!${cfg.headerRange}`,
      valueInputOption: 'RAW', requestBody: { values: [cfg.cols] }
    })
  }
}

async function getRows(sheets, key) {
  const cfg = SHEETS_CONFIG[key]
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${cfg.sheet}'!${cfg.range}` })
    return r.data.values || []
  } catch(e) { return [] }
}

function rowToObj(r, cols) {
  const o = {}
  cols.forEach((c, i) => { o[c] = r[i] || '' })
  return o
}

function objToRow(o, cols) {
  return cols.map(c => o[c] ?? '')
}

function rangeForRow(cfg, rowNum) {
  const lastCol = String.fromCharCode(64 + cfg.cols.length)
  return `'${cfg.sheet}'!A${rowNum}:${lastCol}${rowNum}`
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'funnel'
    if (!SHEETS_CONFIG[type]) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    const sheets = getSheets()
    await ensureSheet(sheets, type)
    const rows = await getRows(sheets, type)
    return NextResponse.json(rows.map(r => rowToObj(r, SHEETS_CONFIG[type].cols)))
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const sheets = getSheets()
    const body = await req.json()
    const type = body.type || 'funnel'
    if (!SHEETS_CONFIG[type]) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    const cfg = SHEETS_CONFIG[type]
    await ensureSheet(sheets, type)

    if (body.action === 'add') {
      const rows = await getRows(sheets, type)
      const nextRow = rows.length + 2
      const id = uid()
      const created = { ...body, id, createdAt: new Date().toISOString(), creationDate: new Date().toISOString() }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: rangeForRow(cfg, nextRow),
        valueInputOption: 'RAW',
        requestBody: { values: [objToRow(created, cfg.cols)] }
      })
      return NextResponse.json({ success: true, id })
    }

    if (body.action === 'update') {
      const rows = await getRows(sheets, type)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const rowNum = idx + 2
      const cur = rowToObj(rows[idx], cfg.cols)
      const merged = { ...cur, ...body, id: cur.id, lastInteractedOn: new Date().toISOString() }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: rangeForRow(cfg, rowNum),
        valueInputOption: 'RAW',
        requestBody: { values: [objToRow(merged, cfg.cols)] }
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete') {
      const rows = await getRows(sheets, type)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const sheetId = meta.data.sheets.find(s=>s.properties.title===cfg.sheet).properties.sheetId
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension:'ROWS', startIndex: idx+1, endIndex: idx+2 } } }] }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}