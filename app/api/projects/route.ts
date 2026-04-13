// @ts-nocheck
import { NextResponse } from 'next/server'
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

// Get the exact sheet title and sheetId by looking for a sheet whose title contains "roject"
async function getProjectSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  const sheet = meta.data.sheets?.find(s => s.properties?.title?.toLowerCase().includes('roject'))
  if (!sheet) throw new Error('Could not find a Projects sheet. Sheet names: ' + meta.data.sheets?.map(s => s.properties?.title).join(', '))
  return { title: sheet.properties.title, sheetId: sheet.properties.sheetId }
}

export async function GET() {
  try {
    const sheets = getSheets()
    const { title } = await getProjectSheet(sheets)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SID(),
      range: `${title}!A2:D`
    })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2,
      name: r[0] || '',
      description: r[1] || '',
      createdBy: r[2] || '',
      createdAt: r[3] || '',
    }))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Projects GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body
    const sheets = getSheets()
    const { title, sheetId } = await getProjectSheet(sheets)

    if (action === 'add') {
      const { name, description, createdBy } = body
      // Get all rows to find next empty row
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SID(),
        range: `${title}!A1:A`
      })
      const nextRow = (existing.data.values || []).length + 1
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(),
        range: `${title}!A${nextRow}:D${nextRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, description || '', createdBy || '', new Date().toISOString().split('T')[0]]] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { id } = body
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: id - 1, endIndex: id }
        }}]}
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false }, { status: 400 })
  } catch (err) {
    console.error('Projects POST error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}