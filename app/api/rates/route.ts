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

async function ensureSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  if (!meta.data.sheets.find(s=>s.properties.title==='Employee_Rates')) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests:[{ addSheet:{ properties:{ title:'Employee_Rates' } } }] } })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: "'Employee_Rates'!A1:G1",
      valueInputOption: 'RAW', requestBody: { values: [['id','email','name','clientName','projectName','hourlyRate','updatedAt']] }
    })
  }
}

async function getRows(sheets) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Employee_Rates'!A2:G5000" })
    return r.data.values || []
  } catch(e) { return [] }
}

export async function GET() {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const rows = await getRows(sheets)
    const rates = rows.map((r, idx) => ({
      id: r[0], email: r[1]||'', name: r[2]||'', clientName: r[3]||'',
      projectName: r[4]||'N/A', hourlyRate: parseFloat(r[5])||0,
      updatedAt: r[6]||'', _row: idx + 2
    }))
    return NextResponse.json(rates)
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const body = await req.json()

    if (body.action === 'add') {
      const rows = await getRows(sheets)
      const nextRow = rows.length + 2
      const id = uid()
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Employee_Rates'!A${nextRow}:G${nextRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[id, body.email||'', body.name||'', body.clientName||'', body.projectName||'N/A', body.hourlyRate||0, new Date().toISOString()]] }
      })
      return NextResponse.json({ success: true, id })
    }

    if (body.action === 'update') {
      const rows = await getRows(sheets)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const rowNum = idx + 2
      const cur = rows[idx]
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Employee_Rates'!A${rowNum}:G${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[cur[0], body.email??cur[1], body.name??cur[2], body.clientName??cur[3], body.projectName??cur[4], body.hourlyRate??cur[5], new Date().toISOString()]] }
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete') {
      const rows = await getRows(sheets)
      const idx = rows.findIndex(r => r[0] === body.id)
      if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const sheetId = meta.data.sheets.find(s=>s.properties.title==='Employee_Rates').properties.sheetId
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension:'ROWS', startIndex: idx+1, endIndex: idx+2 } } }] }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}